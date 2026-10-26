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

## Limites

- Résolution **fichier + ligne** du `.tpl` ; précision ligne au niveau de la ligne d'ouverture du tag.
- Pas de marqueur dans `<script>` / `<style>` / `<pre>` / `<textarea>` ni au milieu d'un tag :
  un tel élément hérite du marqueur précédent (rare).
- Les marqueurs sont gravés au **1er compile** Smarty (pas de `force_compile` → aucune recompilation
  à chaque requête) : **vider le cache une fois** après activation ; ensuite `compile_check` ne
  recompile que les `.tpl` modifiés.
