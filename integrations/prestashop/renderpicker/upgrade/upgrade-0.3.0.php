<?php
/**
 * Script d'upgrade standard PrestaShop : s'exécute automatiquement quand
 * `$this->version` (renderpicker.php) passe à 0.3.0 détecté en base (prochain
 * chargement de la page Modules en back-office).
 *
 * Nécessaire car `override/classes/Hook.php` est un NOUVEAU fichier ajouté après
 * l'installation initiale du module : un simple `sync-prestashop.mjs` (copie disque)
 * ne suffit pas à le faire apparaître à la racine du site (`override/classes/`) —
 * seul `Module::installOverrides()` (joué normalement à l'installation) fait cette
 * copie + régénère le cache de classes. On la rejoue ici (même mécanisme que
 * `upgrade-0.2.0.php` pour `Module.php`).
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

function upgrade_module_0_3_0($module)
{
    return $module->installOverrides();
}
