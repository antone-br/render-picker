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
    /** Nom du thème actif — sert à rediriger les .tpl de module vers l'override du thème. */
    private static $themeName = '';

    public function __construct()
    {
        $this->name = 'renderpicker';
        $this->tab = 'administration';
        $this->version = '0.2.0';
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
            && $this->registerHook('actionFrontControllerSetMedia')
            && $this->registerHook('displayFooter');
    }

    /**
     * Joué pendant `FrontController::setMedia()`, avant le rendu du layout : bon
     * moment pour poser le prefilter (templates compilés plus tard) et charger le JS.
     */
    public function hookActionFrontControllerSetMedia($params)
    {
        // Pas _PS_MODE_DEV_ : instable sur ce setup (SmartyDevTemplate + templates de
        // module -> 500). Interrupteur dedie, defini par docker/config/defines.local.php.
        if (!defined('_RENDER_PICKER_ENABLED_') || !_RENDER_PICKER_ENABLED_) {
            return;
        }

        // 1. Prefilter Smarty (marqueurs rp@file:line). PAS de force_compile (recompiler
        //    tous les .tpl à chaque requête = très lent sur bind-mount). Les marqueurs sont
        //    gravés au 1er compile ; `compile_check` recompile ensuite seulement les .tpl
        //    modifiés. → vider le cache UNE fois après activation (voir README).
        self::$themeName = (string) $this->context->shop->theme_name;
        $this->context->smarty->registerFilter('pre', ['RenderPicker', 'smartyPrefilter']);

        // 2. Racine projet → window.renderPickerRoot (auto-init du bundle).
        //    LOCAL DEV (Docker) : _PS_ROOT_DIR_ = chemin DANS le conteneur (/var/www/html),
        //    mais l'editeur tourne sur l'HOTE -> vscode://file/... doit pointer sur le vrai
        //    chemin hote (bind mount 1:1, chemin relatif identique des deux cotes). Ce
        //    chemin varie par machine/dev -> passe en variable d'env Docker
        //    (HOST_PUBLIC_HTML_PATH, voir docker/.env + docker-compose.yml), jamais en dur
        //    ici. Hors Docker (env var absente) : _PS_ROOT_DIR_ est deja le bon chemin.
        $hostRoot = getenv('HOST_PUBLIC_HTML_PATH');
        $root = $hostRoot !== false
            ? rtrim(str_replace('\\', '/', $hostRoot), '/')
            : rtrim(str_replace('\\', '/', _PS_ROOT_DIR_), '/');

        // 3. Dossier admin (renommé pour la sécu, ex. "admin222") → segment d'URL pour le
        //    lien "Copier l'URL de configuration" du menu overlay modules. _PS_ADMIN_DIR_
        //    n'existe QUE dans le bootstrap admin (admin/index.php le définit localement) —
        //    indisponible ici (hook FRONT) : passé en variable d'env Docker (PS_ADMIN_DIRNAME,
        //    voir docker/.env + docker-compose.yml), même pattern que HOST_PUBLIC_HTML_PATH.
        //    Pas de token : calculé en contexte FRONT (Context::employee est null hors
        //    back-office) il ne peut de toute façon pas matcher la session admin réelle —
        //    même interstitiel "token invalide, continuer" avec ou sans, pas la peine.
        $adminDirName = (string) getenv('PS_ADMIN_DIRNAME');

        Media::addJsDef([
            'renderPickerRoot' => $root,
            'renderPickerAdminDir' => $adminDirName,
        ]);
    }

    /**
     * Injecte le <script> du bundle directement dans le footer (dev only).
     * `registerJavascript` (queue "bottom") ne sortait pas dans ce theme -> balise
     * directe, plus fiable.
     */
    public function hookDisplayFooter($params)
    {
        if (!defined('_RENDER_PICKER_ENABLED_') || !_RENDER_PICKER_ENABLED_) {
            return '';
        }
        $jsFile = _PS_MODULE_DIR_ . $this->name . '/views/js/render-picker.global.js';
        $v = @filemtime($jsFile) ?: $this->version;
        $src = __PS_BASE_URI__ . 'modules/' . $this->name . '/views/js/render-picker.global.js?v=' . $v;

        return '<script src="' . htmlspecialchars($src, ENT_QUOTES) . '"></script>';
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

        // Resource Smarty `module:<nom>/<relpath>` (`SmartyResourceModuleCore`, custom
        // resource) : `source->filepath` n'est PAS un chemin disque — Smarty le réduit à
        // un identifiant tronqué/sanitizé pour nommer le fichier compilé
        // (`Smarty_Resource_Custom::populate()` : type + 25 premiers caractères
        // alphanumériques du nom, slashs/underscores retirés → "module:pscontactinfonav.tpl").
        // `source->name` reste fiable (nom de resource non altéré, ex. "ps_contactinfo/nav.tpl").
        if ($template->source->type === 'module') {
            $rel = 'modules/' . str_replace('\\', '/', (string) $template->source->name);
        } else {
            $abs = str_replace('\\', '/', (string) $template->source->filepath);
            $rel = (strpos($abs, $root) === 0)
                ? ltrim(substr($abs, strlen($root)), '/')
                : $abs;
        }

        // Un .tpl rendu depuis `modules/<m>/…` mais dont le thème a une copie override
        // (`themes/<theme>/modules/<m>/…`) → pointer vers la copie du thème (c'est là
        // qu'on édite). Seulement si le fichier override existe réellement.
        if (self::$themeName !== '' && strpos($rel, 'modules/') === 0) {
            $themeRel = 'themes/' . self::$themeName . '/' . $rel;
            if (is_file($root . '/' . $themeRel)) {
                $rel = $themeRel;
            }
        }

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
