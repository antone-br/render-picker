# render-picker (dev) — module PrestaShop

Rend render-picker utilisable sur un thème **Smarty** (`.tpl`) : pick d'un élément →
`data-source` = `themes/.../x.tpl:<ligne>`, Ctrl+clic → ouvre le `.tpl` à la bonne ligne
dans l'éditeur (VS Code, PhpStorm…). **Dev only** (inactif hors `_PS_MODE_DEV_`).

## Comment ça marche

Sur le hook `actionFrontControllerSetMedia` (dev only) :
1. un **prefilter Smarty** insère devant chaque élément un commentaire
   `<!-- rp@<relpath>:<ligne> -->` (relpath = chemin du `.tpl` relatif à la racine du site) ;
2. le build global `render-picker.global.js` (render-picker + React bundlés) est chargé via
   `registerJavascript`, et la racine projet est exposée en `window.renderPickerRoot` (`Media::addJsDef`) ;
   le bundle **s'auto-initialise** (pas de `<script>` ni de `<meta>` à écrire).
3. Côté client, `initTplAnnotator` lit les marqueurs et pose `data-source` / `data-component`
   sur chaque élément. Le reste (pick, XPath, CSS, Ctrl+clic → éditeur) est identique au mode React.

L'ouverture éditeur passe par l'URI `vscode://file/<root>/<relpath>:<ligne>` (aucun serveur requis).

## Installation (3 étapes, rien à builder)

Le JS bundlé (`views/js/render-picker.global.js`) est déjà fourni.

1. **Copier** ce dossier dans les modules de la boutique :
   `integrations/prestashop/renderpicker/` → `<site>/modules/renderpicker/`.
2. **Activer** : back-office → *Modules* → chercher « render-picker » → *Installer*.
3. **Mode dev** : `_PS_MODE_DEV_ = true;` dans `config/defines.inc.php`, puis vider le cache
   (*Paramètres avancés → Performances → Vider le cache*).

Prêt : page front → armer (double-tap **Maj**) → pick → **Ctrl+clic** ouvre le `.tpl` à la bonne ligne.

### Docker (éditeur sur l'hôte)

Si le site tourne en conteneur (le serveur voit `/var/www/html`) mais que VS Code tourne sur l'hôte,
pose le chemin hôte une fois dans la console du navigateur puis recharge :

```js
localStorage.renderPickerRoot = "C:/Users/you/.../public_html"
```

### Reconstruire le bundle (optionnel)

```bash
# depuis le repo render-picker
npm run build:standalone && npm run sync:prestashop
```

> Ciblé **PrestaShop 1.7.x** (Smarty 3). API utilisées : hook `actionFrontControllerSetMedia`,
> `registerJavascript`, `Media::addJsDef`, `smarty->registerFilter('pre', …)`.

## Rectangles permanents "modules PrestaShop"

Toggle du menu paramètres (engrenage, « Rectangles modules PrestaShop ») : affiche, en
permanence (plus besoin de piquer), un rectangle sur chaque **module racine** de la page —
nom + durée de rendu du hook (ms). Ctrl+clic (ou le geste configuré) sur un rectangle ouvre
le `.tpl` correspondant dans l'éditeur, comme pour un pick normal.

Nécessite l'override `override/classes/Module.php` (fourni, voir `.claude/.docs/architecture.md`
à la racine du repo) — sans lui, le toggle ne fait rien (aucun marqueur de durée dans le HTML).

**Important** : PrestaShop ne scanne `override/classes/` qu'à la **racine du site**, jamais
dans `modules/<m>/override/`. Ce dossier n'est copié à la racine que pendant l'**installation**
du module (`Module::installOverrides()`). Si `renderpicker` était déjà installé avant
l'ajout de cet override (ex. mise à jour par simple `sync-prestashop.mjs`, sans
réinstallation), le fichier reste invisible à PrestaShop → 0 rectangle, aucun marqueur
`rp-module`. Le module embarque un script d'upgrade (`upgrade/upgrade-0.2.0.php`) qui rejoue
`installOverrides()` automatiquement dès que back-office détecte le bump de version — visiter
une fois la page *Modules* suffit, pas de uninstall/install manuel. Sur un site déjà sur
`0.2.0+`, un futur ajout d'override nécessitera un nouveau bump de version + script
d'upgrade correspondant.

## Limites

- Résolution **fichier + ligne** du `.tpl` ; précision ligne au niveau de la ligne d'ouverture du tag.
- Pas de marqueur dans `<script>` / `<style>` / `<pre>` / `<textarea>` ni au milieu d'un tag :
  un tel élément hérite du marqueur précédent (rare).
- Les marqueurs sont gravés au **1er compile** Smarty (pas de `force_compile` → aucune recompilation
  à chaque requête) : **vider le cache une fois** après activation ; ensuite `compile_check` ne
  recompile que les `.tpl` modifiés.
- Un `.tpl` de module rendu depuis `modules/<m>/…` est redirigé vers l'**override du thème**
  (`themes/<theme>/modules/<m>/…`) **si cette copie existe** — c'est là qu'on édite. Sinon, le `.tpl`
  du module lui-même.
- Rectangles modules : la durée mesurée est celle de `Module::fetch()` (compile + rendu Smarty),
  pas le PHP exécuté par le module avant l'appel (assignation de variables…) — écart marginal en
  pratique. Un seul rectangle par module racine (pas de rectangle pour un widget qu'un module
  inclut lui-même dans son propre `.tpl`).
