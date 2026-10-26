<?php
/**
 * render-picker (dev) — module PrestaShop (ciblé 1.7.x, Smarty 3).
 *
 * Actif UNIQUEMENT quand `_PS_MODE_DEV_` est vrai. Sur le hook front
 * `actionFrontControllerSetMedia` (joué avant le rendu du layout) :
 *  1. enregistre un prefilter Smarty qui insère, devant chaque ligne ouvrant un
 *     élément HTML, un commentaire marqueur `<!-- rp@<relpath>:<ligne> -->`
 *     (relpath = chemin du .tpl relatif à la racine du site) ;
 *  2. charge le build global `render-picker.global.js` (API `registerJavascript`) ;
 *  3. expose la racine projet au JS via `Media::addJsDef` (`window.renderPickerRoot`).
 *
 * Le bundle s'auto-initialise (lecture de `window.renderPickerRoot`). L'adapter JS
 * lit les marqueurs → pose `data-source` → Ctrl+clic ouvre le .tpl à la bonne ligne.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class RenderPicker extends Module
{
    public function __construct()
    {
        $this->name = 'renderpicker';
        $this->tab = 'administration';
        $this->version = '0.1.0';
        $this->author = 'Antone Barbaud';
        $this->need_instance = 0;
        $this->bootstrap = true;
        $this->ps_versions_compliancy = ['min' => '1.7', 'max' => _PS_VERSION_];

        parent::__construct();

        $this->displayName = 'render-picker (dev)';
        $this->description = 'Dev-only : pick d\'un élément DOM → ouvre son .tpl Smarty dans l\'éditeur.';
    }

    public function install()
    {
        return parent::install()
            && $this->registerHook('actionFrontControllerSetMedia');
    }

    /**
     * Joué pendant `FrontController::setMedia()`, avant le rendu du layout : bon
     * moment pour poser le prefilter (templates compilés plus tard) et charger le JS.
     */
    public function hookActionFrontControllerSetMedia($params)
    {
        if (!_PS_MODE_DEV_) {
            return;
        }

        // 1. Prefilter Smarty (marqueurs rp@file:line). force_compile : réintègre
        //    les marqueurs à chaque requête sans vidage manuel du cache.
        $smarty = $this->context->smarty;
        $smarty->force_compile = true;
        $smarty->registerFilter('pre', ['RenderPicker', 'smartyPrefilter']);

        // 2. Charge le build global en fin de page (après les jsDef PrestaShop).
        $this->context->controller->registerJavascript(
            'renderpicker',
            'modules/' . $this->name . '/views/js/render-picker.global.js',
            ['position' => 'bottom', 'priority' => 1000]
        );

        // 3. Racine projet → window.renderPickerRoot (auto-init du bundle).
        Media::addJsDef([
            'renderPickerRoot' => rtrim(str_replace('\\', '/', _PS_ROOT_DIR_), '/'),
        ]);
    }

    /**
     * Prefilter Smarty : insère un marqueur `<!-- rp@relpath:ligne -->` devant chaque
     * ligne dont le 1er caractère non blanc ouvre un élément HTML (`<tag`), hors
     * fermetures (`</`), commentaires (`<!--`), déclarations (`<!doctype`) et à
     * l'intérieur de <script>/<style>/<pre>/<textarea>.
     *
     * @param string $source   source du template
     * @param object $template Smarty_Internal_Template
     */
    public static function smartyPrefilter($source, $template)
    {
        $root = rtrim(str_replace('\\', '/', _PS_ROOT_DIR_), '/');
        $abs = str_replace('\\', '/', (string) $template->source->filepath);
        $rel = (strpos($abs, $root) === 0)
            ? ltrim(substr($abs, strlen($root)), '/')
            : $abs;

        $lines = preg_split('/\r\n|\n|\r/', $source);
        $out = [];
        $inRaw = false; // dans script/style/pre/textarea

        foreach ($lines as $i => $line) {
            $ln = $i + 1;

            if (!$inRaw
                && preg_match('/^\s*<[a-zA-Z]/', $line)
                && !preg_match('#^\s*</#', $line)
                && !preg_match('/^\s*<!--/', $line)
            ) {
                $out[] = '<!-- rp@' . $rel . ':' . $ln . ' -->';
            }

            $out[] = $line;

            if (!$inRaw && preg_match('/<(script|style|pre|textarea)\b/i', $line)) {
                $inRaw = true;
            }
            if ($inRaw && preg_match('#</(script|style|pre|textarea)>#i', $line)) {
                $inRaw = false;
            }
        }

        return implode("\n", $out);
    }
}
