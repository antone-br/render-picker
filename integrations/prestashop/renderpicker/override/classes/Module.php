<?php
/**
 * Override `classes/Module.php` (mécanisme standard PrestaShop `override/`, pas un
 * hack core) : chronomètre et nomme chaque module dont le rendu passe par
 * `Module::fetch()` **ou** `Module::display()` — deux points d'entrée stables
 * utilisés par les modules 1.7.x pour rendre leurs `.tpl` (widgets `hookDisplayXXX`),
 * contrairement à `Hook::exec()` dont la boucle interne module-par-module n'est pas
 * un point d'extension documenté et change selon la version (voir
 * `.claude/.docs/architecture.md` à la racine du repo).
 * `display()` ne délègue pas à `fetch()` (appelle directement
 * `Smarty_Internal_Template::fetch()`) — d'où les deux overrides séparés, partageant
 * la même logique via `rpFinish()`.
 *
 * Limite assumée : seul le temps de rendu Smarty est mesuré, pas le PHP exécuté par
 * le module avant l'appel (assignation de variables…). En pratique cet écart est
 * marginal (la plupart des hook methods assignent puis appellent fetch()/display()
 * immédiatement après).
 *
 * Racine uniquement (pas de rectangle pour un widget qu'un module inclut lui-même
 * dans son propre `.tpl`) : compteur de profondeur statique partagé entre fetch() et
 * display(), wrap seulement à profondeur 0.
 *
 * Nom du hook dans le marqueur : lu via `Hook::rpCurrentHookName()` (override
 * `Hook.php`, pile empilée par son `exec()` surchargé) — `fetch()`/`display()` seuls ne
 * le reçoivent jamais, contrairement à `exec()` qui le connaît en entrée.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class Module extends ModuleCore
{
    /** Profondeur d'appels fetch()/display() imbriqués (widget dans widget). */
    private static $rpDepth = 0;

    public function fetch($template, $cache_id = null, $compile_id = null)
    {
        if (!defined('_RENDER_PICKER_ENABLED_') || !_RENDER_PICKER_ENABLED_) {
            return parent::fetch($template, $cache_id, $compile_id);
        }

        $isRoot = (self::$rpDepth === 0);
        self::$rpDepth++;
        $start = microtime(true);

        try {
            $html = parent::fetch($template, $cache_id, $compile_id);
        } finally {
            self::$rpDepth--;
        }

        return $this->rpFinish($template, $isRoot, $start, $html);
    }

    public function display($file, $template, $cache_id = null, $compile_id = null)
    {
        if (!defined('_RENDER_PICKER_ENABLED_') || !_RENDER_PICKER_ENABLED_) {
            return parent::display($file, $template, $cache_id, $compile_id);
        }

        $isRoot = (self::$rpDepth === 0);
        self::$rpDepth++;
        $start = microtime(true);

        try {
            $html = parent::display($file, $template, $cache_id, $compile_id);
        } finally {
            self::$rpDepth--;
        }

        return $this->rpFinish($template, $isRoot, $start, $html);
    }

    /** Logique commune fetch()/display() : log, résolution source, wrap racine. */
    private function rpFinish($template, $isRoot, $start, $html)
    {
        error_log(sprintf(
            '[render-picker] rendu module=%s root=%s template=%s',
            $this->name,
            $isRoot ? 'yes' : 'no',
            is_string($template) ? $template : gettype($template)
        ));

        if (!$isRoot || !is_string($html)) {
            return $html;
        }

        $durationMs = round((microtime(true) - $start) * 1000, 1);
        // Marqueur rp@ précis (ligne réelle) d'abord ; sinon repli sur $template
        // (ligne approximée à 1, mais dispo pour ~100% des rendus contrairement au
        // marqueur rp@ qui dépend d'une heuristique fragile sur le .tpl source —
        // beaucoup de petits widgets n'ont aucun tag en tête de ligne).
        $source = self::rpFirstMarker($html) ?? self::rpFallbackSource($template, $this->name);

        error_log(sprintf(
            '[render-picker] module=%s duration=%sms source=%s',
            $this->name,
            $durationMs,
            $source ?? '(aucune source résolue)'
        ));

        if ($source === null) {
            return $html;
        }

        $name = str_replace(['-->', '<!--'], '', $this->name);
        $hookName = class_exists('Hook') && method_exists('Hook', 'rpCurrentHookName')
            ? (string) Hook::rpCurrentHookName()
            : '';
        $hookName = str_replace([':', '-->', '<!--'], '', $hookName);

        return '<!-- rp-module:' . $name . ':' . $hookName . ':' . $durationMs . ':' . $source . ' -->'
            . $html
            . '<!-- /rp-module -->';
    }

    /** Premier marqueur `rp@relpath:ligne` trouvé dans le HTML rendu, ou `null`. */
    private static function rpFirstMarker($html)
    {
        if (preg_match('/<!--\s*rp@([^\s:]+:\d+)\s*-->/', $html, $m)) {
            return $m[1];
        }

        return null;
    }

    /**
     * Repli sans marqueur rp@ : déduit `modules/<nom>/<relpath>:1` de la ressource
     * Smarty passée à fetch()/display() (format observé pour fetch() :
     * `module:<nom>/<relpath>` ; pour display() : chemin relatif simple, ex.
     * `categories-block.tpl`). Ligne toujours `1` (pas de vraie position) — et ne
     * tient pas compte d'une éventuelle surcharge thème
     * (`themes/<theme>/modules/<nom>/…`), contrairement au prefilter Smarty qui la
     * gère pour les marqueurs rp@ précis.
     */
    private static function rpFallbackSource($template, $moduleName)
    {
        if (!is_string($template)) {
            return null;
        }
        if (preg_match('#^module:([^/]+)/(.+)$#', $template, $m)) {
            return 'modules/' . $m[1] . '/' . $m[2] . ':1';
        }

        return 'modules/' . $moduleName . '/' . basename($template) . ':1';
    }
}
