<?php
/**
 * Override `classes/Hook.php` (mécanisme standard PrestaShop `override/`) : empile le nom
 * du hook en cours d'exécution pour que `Module.php` (override, `rpFinish()`) puisse le
 * glisser dans le marqueur `rp-module`. `Module::fetch()`/`display()` ne reçoivent jamais
 * le nom du hook — `Hook::exec($hook_name, ...)` est le seul point centralisé qui le
 * connaît, juste avant d'appeler la méthode `hookXxx()` du module.
 *
 * Pile plutôt que simple variable : un hook peut en déclencher un autre de façon imbriquée
 * (`{hook h='...'}` Smarty inline dans le `.tpl` d'un module en cours de rendu) — `exec()`
 * est ré-entrant, il faut restaurer le hook englobant une fois le hook imbriqué terminé.
 *
 * Signature identique à `HookCore::exec()` (PrestaShop 1.7.8.x) — vérifiée directement
 * dans `classes/Hook.php` du core avant d'écrire cet override (un override Hook, point
 * de passage de TOUT hook du site, est high-blast-radius si la signature diverge).
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class Hook extends HookCore
{
    /** Pile des noms de hook en cours d'exécution (ré-entrance via {hook} inline). */
    private static $rpHookStack = [];

    public static function exec(
        $hook_name,
        $hook_args = [],
        $id_module = null,
        $array_return = false,
        $check_exceptions = true,
        $use_push = false,
        $id_shop = null,
        $chain = false
    ) {
        $enabled = defined('_RENDER_PICKER_ENABLED_') && _RENDER_PICKER_ENABLED_;
        if ($enabled) {
            self::$rpHookStack[] = (string) $hook_name;
        }

        try {
            return parent::exec(
                $hook_name,
                $hook_args,
                $id_module,
                $array_return,
                $check_exceptions,
                $use_push,
                $id_shop,
                $chain
            );
        } finally {
            if ($enabled) {
                array_pop(self::$rpHookStack);
            }
        }
    }

    /** Nom du hook en cours (sommet de la pile), ou `null` hors de tout `exec()`. */
    public static function rpCurrentHookName()
    {
        return empty(self::$rpHookStack) ? null : end(self::$rpHookStack);
    }
}
