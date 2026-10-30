# render-picker — module PrestaShop : architecture technique

> Complète `README.md` (install + usage). Ici : comment ça marche sous le capot,
> pourquoi chaque choix, les pièges déjà rencontrés.

---

## Vue d'ensemble

```
hookActionFrontControllerSetMedia (dev only)
  ├─ 1. registerFilter('pre', smartyPrefilter)   → marqueurs rp@file:line gravés au compile
  └─ 2. Media::addJsDef(renderPickerRoot)         → racine projet exposée au JS

hookDisplayFooter (dev only)
  └─ <script src=".../render-picker.global.js">  → bundle (render-picker + React), auto-init

Côté client (bundle) :
  initTplAnnotator lit les marqueurs HTML → pose data-source/data-component
  → pick (Maj x2) → Ctrl+clic → vscode://file/<root>/<relpath>:<ligne>
```

Deux hooks, deux rôles distincts : `actionFrontControllerSetMedia` pose le prefilter
**avant** compilation Smarty ; `displayFooter` injecte le `<script>` une fois le HTML
du layout prêt.

---

## Interrupteur `_RENDER_PICKER_ENABLED_`

Les deux hooks testent `_RENDER_PICKER_ENABLED_` (constante dédiée), **pas**
`_PS_MODE_DEV_` directement. Raison : sur le setup de dev visé, `_PS_MODE_DEV_` seul
est instable — combiné à `SmartyDevTemplate` et aux templates de module, il produit
des 500. La constante est définie côté `docker/config/defines.local.php`, hors de ce
module : active le module indépendamment de `_PS_MODE_DEV_`, sans toucher au cœur
PrestaShop.

---

## `hookActionFrontControllerSetMedia`

Joué pendant `FrontController::setMedia()`, **avant** le rendu du layout — seul
moment où poser un prefilter Smarty a un effet (les templates ne sont pas encore
compilés).

### 1. Prefilter Smarty

```php
self::$themeName = (string) $this->context->shop->theme_name;
$this->context->smarty->registerFilter('pre', ['RenderPicker', 'smartyPrefilter']);
```

`$themeName` est stocké en **propriété statique** : le prefilter (`smartyPrefilter`,
appelé en callback statique par Smarty) n'a pas accès à `$this->context` — c'est le
seul canal pour lui passer le thème actif.

Pas de `force_compile` : recompiler tous les `.tpl` à chaque requête serait très lent
sur bind-mount Docker. Les marqueurs sont gravés **au premier compile** ; ensuite
`compile_check` ne recompile que les `.tpl` modifiés → **vider le cache une fois**
après activation (voir README), sinon les anciens `.tpl` compilés restent sans
marqueur.

### 2. Racine projet → `window.renderPickerRoot`

```php
$hostRoot = getenv('HOST_PUBLIC_HTML_PATH');
$root = $hostRoot !== false
    ? rtrim(str_replace('\\', '/', $hostRoot), '/')
    : rtrim(str_replace('\\', '/', _PS_ROOT_DIR_), '/');
```

`vscode://file/<root>/<relpath>:<ligne>` doit pointer sur un chemin que **l'éditeur**
(sur l'hôte) comprend, pas sur le chemin vu par le serveur.

- **Hors Docker** : serveur et éditeur partagent le même filesystem → `_PS_ROOT_DIR_`
  suffit.
- **Docker** : `_PS_ROOT_DIR_` = chemin **conteneur** (`/var/www/html`), inutile pour
  l'éditeur hôte. Le bind-mount étant 1:1 (chemin relatif identique des deux côtés),
  il suffit de connaître la racine hôte → variable d'env `HOST_PUBLIC_HTML_PATH`
  (posée dans `docker/.env` + `docker-compose.yml`, varie par machine/dev, jamais en
  dur dans le module).

Fallback client : `localStorage.renderPickerRoot` (voir README) si la variable d'env
n'est pas câblée.

---

## `hookDisplayFooter`

```php
return '<script src="' . htmlspecialchars($src, ENT_QUOTES) . '"></script>';
```

Injecte directement une balise `<script>` dans le footer plutôt que d'utiliser
`registerJavascript` (API standard PrestaShop, queue `position: bottom`) : sur le
thème ciblé, cette queue ne sortait pas dans le HTML final (thème ne respecte pas le
hook de queue bas). Balise directe = garanti de sortir.

`?v=<filemtime>` (fallback `$this->version`) : force le rechargement navigateur +
cache combiné (CCC) à chaque rebuild du bundle, sans bump de version manuel.

Le bundle est auto-init (lit `window.renderPickerRoot` au chargement) : aucun
`<script>` inline de config à écrire.

---

## `smartyPrefilter` — marqueurs `rp@relpath:ligne`

```php
public static function smartyPrefilter($source, $template)
```

Callback statique Smarty : reçoit la source brute du `.tpl` **avant compilation**,
retourne la source modifiée.

### Résolution du chemin relatif

```php
$abs = str_replace('\\', '/', (string) $template->source->filepath);
$rel = (strpos($abs, $root) === 0) ? ltrim(substr($abs, strlen($root)), '/') : $abs;
```

`$template->source->filepath` = chemin absolu du `.tpl` réellement rendu. Retiré du
préfixe `_PS_ROOT_DIR_` → chemin relatif site (`themes/.../tpl/x.tpl`).

### Redirection module → override thème

```php
if (self::$themeName !== '' && strpos($rel, 'modules/') === 0) {
    $themeRel = 'themes/' . self::$themeName . '/' . $rel;
    if (is_file($root . '/' . $themeRel)) {
        $rel = $themeRel;
    }
}
```

PrestaShop permet à un thème de surcharger le `.tpl` d'un module en plaçant une copie
sous `themes/<theme>/modules/<module>/...`. Si cette copie existe, **c'est elle qui
est éditée** en pratique (celle du module d'origine ne serait jamais modifiée) — donc
le marqueur pointe vers l'override, pas vers le fichier source du module. Vérifié par
`is_file` : pas de copie → marqueur reste sur le `.tpl` du module.

### Insertion ligne par ligne

```php
foreach ($lines as $i => $line) {
    if (!$inRaw
        && preg_match('/^\s*<[a-zA-Z]/', $line)
        && !preg_match('#^\s*</#', $line)
        && !preg_match('/^\s*<!--/', $line)
    ) {
        $out[] = '<!-- rp@' . $rel . ':' . $ln . ' -->';
    }
    $out[] = $line;
    // bascule $inRaw sur <script|style|pre|textarea> ouvrant/fermant
}
```

Règle : un marqueur devant chaque ligne dont le premier caractère non blanc ouvre un
tag HTML (`<tag`), sauf fermetures (`</`), commentaires (`<!--`) et déclarations
(`<!doctype`, implicitement exclue par `[a-zA-Z]`). Suspendu à l'intérieur de
`<script>`/`<style>`/`<pre>`/`<textarea>` (`$inRaw`) — contenu brut, pas du HTML
structurel.

---

## Rectangles permanents "modules PrestaShop" — `override/classes/Module.php`

Toggle settings (`showModuleOverlay`) qui dessine un rectangle permanent par module racine,
avec nom + durée de rendu, Ctrl+clic → éditeur. Deux mécanismes séparés des marqueurs `rp@`
(statiques, gravés au compile) :

### Côté PHP : mesurer et nommer, dynamique, par requête

`override/classes/Module.php` surcharge `Module::fetch()` (mécanisme standard PrestaShop
`override/`, pas une modification du core) :

```php
class Module extends ModuleCore
{
    public function fetch($template, $cache_id = null, $compile_id = null)
    {
        // chronomètre parent::fetch(), wrap le HTML si profondeur 0
    }
}
```

Choix de `Module::fetch()` plutôt que `Hook::exec()` : `Hook::exec()` boucle en interne
module par module sans point d'extension documenté à cette granularité, et sa logique
change selon la version — la dupliquer dans un override serait fragile (risque de casser
l'exécution des hooks lors d'une montée de version PrestaShop). `Module::fetch()` est un
point d'entrée **stable et public**, utilisé par la quasi-totalité des modules 1.7.x pour
rendre leurs `.tpl` (widgets `hookDisplayXXX`). Limite assumée : seul le temps de `fetch()`
(compile + rendu Smarty) est mesuré, pas le PHP exécuté par le module avant l'appel
(assignation de variables…) — écart marginal en pratique (la plupart des hook methods
assignent puis appellent `fetch()` immédiatement après).

Racine uniquement : compteur statique `self::$rpDepth`, incrémenté/décrémenté à chaque
appel ; le wrap n'a lieu qu'à profondeur 0 (pas de rectangle pour un widget qu'un module
inclut lui-même dans son propre `.tpl`).

Le marqueur de fin de source (`relpath:ligne`) est extrait du **premier marqueur `rp@`**
déjà présent dans le HTML rendu (`rpFirstMarker`, regex) — aucune nouvelle résolution de
chemin, réutilise le travail du prefilter Smarty. Si aucun marqueur `rp@` n'est trouvé
(template sans tag HTML en 1ère position de ligne) : pas de wrap, pas de rectangle mort.

Sortie : `<!-- rp-module:<nom>:<duréeMs>:<relpath>:<ligne> --><html module…><!-- /rp-module -->`.

Comme pour les autres hooks, actif uniquement si `_RENDER_PICKER_ENABLED_`.

### Piège déploiement : OPcache + cache de classes PrestaShop

Ajouter/modifier `override/classes/Module.php` **après** la première installation du module
ne suffit pas à lui seul. Trois caches indépendants doivent être rafraîchis, dans cet ordre,
sinon l'override reste invisible silencieusement (aucune erreur, juste aucun log, aucun
marqueur) :

1. **Copie à la racine** : `override/classes/` du module n'est copié dans
   `<site>/override/classes/` que par `Module::installOverrides()` (joué à l'install). Un
   simple sync disque ne suffit pas — voir le script d'upgrade (`upgrade/upgrade-0.2.0.php`)
   qui la rejoue automatiquement au bump de version. Vérifier :
   `(new ReflectionClass('Module'))->getFileName()` doit pointer vers l'override.
2. **`class_index.php`** (`_PS_CACHE_DIR_`) : mappe `Module` → son fichier réel. Index
   régénéré par `PrestaShopAutoload::getInstance()->generateIndex()` — pas automatique dans
   tous les cas (dépend de ce qui déclenche le rebuild côté back-office). Vérifiable/forçable
   directement : `docker exec <conteneur> php -r "require '…/config/config.inc.php';
   PrestaShopAutoload::getInstance()->generateIndex();"`.
3. **OPcache** : si `opcache.validate_timestamps=Off` (fréquent en "perf" docker), les workers
   web gardent en mémoire le bytecode compilé de `class_index.php` **et** de l'ancien
   `classes/module.php` tant qu'ils ne redémarrent pas — regénérer l'index ne suffit pas tant
   que les process PHP n'ont pas été relancés. **Redémarrer le conteneur après toute
   régénération d'index** (`docker restart <conteneur>`), pas juste "vider le cache" du
   back-office (qui ne touche que Smarty, pas OPcache).

Par ailleurs, les `.tpl` déjà compilés **avant** l'activation du prefilter Smarty gardent leur
code compilé sans marqueur `rp@` (`compile_check` ne recompile que si le `.tpl` source a changé,
pas si le prefilter a changé) → vider `var/cache/<env>/smarty/compile/` une fois après tout
changement touchant le prefilter.

### Côté JS : scan des marqueurs + dessin

- `src/core/source/module-overlay.ts` (`scanModuleOverlays`) : parcourt le DOM (`TreeWalker`
  sur les commentaires), pour chaque paire `rp-module`/`/rp-module` calcule le rectangle
  englobant des éléments encadrés (`getBoundingClientRect` union, coordonnées **viewport**,
  pas document+scroll — un module `position:fixed` type barre latérale sticky ne bouge pas
  au scroll, un rectangle en coordonnées document s'en détacherait). Pas de wrapper DOM
  ajouté, la mise en page n'est pas perturbée.
- **Scan au montage (immédiat + différé) + sur scroll/resize/clic — jamais d'observation
  continue du DOM.** Un premier essai observait `childList`/`class`/`style` en continu
  (`MutationObserver`) pour suivre un accordéon Bootstrap (`collapse`) sans ajout de nœud —
  mais un carousel auto-play (ex. owl-carousel) anime son `style` inline en boucle sans
  jamais s'arrêter : observer `style` en continu rescanne (et relogue) à l'infini, jusqu'au
  crash de l'onglet. `initModuleOverlayScan` ne pose donc jamais de `MutationObserver` ni
  d'écoute `class`/`style` — seulement des **événements discrets, bornés par
  l'utilisateur** : un scan immédiat, deux rescans différés au montage
  (`SETTLE_DELAYS_MS`, 400 ms / 1200 ms — rattrapent les animations d'entrée type WOW.js
  `slideInRight`), un rescan sur `scroll`/`resize`, et un rescan sur `click` (+ un différé
  `CLICK_SETTLE_DELAY_MS` après CE clic — rattrape la taille finale d'un accordéon
  Bootstrap `data-toggle="collapse"` une fois sa transition CSS terminée ; ex.
  `ps_contactinfo` footer, qui grandit à l'ouverture). La distinction qui évite de
  retomber dans le bug : un clic ne se répète pas tout seul (pas de boucle possible),
  contrairement à une animation CSS en continu.
- **Remontée au wrapper exclusif du thème.** Un `.tpl` de thème appelle souvent un module
  via `{hook}` à l'intérieur d'un `<div>` qui n'enveloppe *rien d'autre* (ex.
  `<div id="contact_info_sag">` dans `footer-1.tpl`, autour de `ps_contactinfo`). La racine
  stricte du module (entre les commentaires `rp-module`) ne couvre alors que l'intérieur,
  pas le conteneur visuel réel que l'utilisateur perçoit comme "le bloc module" (padding,
  marge du thème inclus). `climbExclusiveWrapper(el)` remonte les ancêtres tant que le
  parent n'a **que `el`** comme enfant élément (`parent.children.length === 1`) — sûr : un
  parent avec plusieurs enfants (cas `tvcmscustomsetting`, frères dont certains d'un autre
  module) arrête la remontée immédiatement, aucun risque d'engloutir un frère étranger qui
  ne serait pas déjà exclu.
- **Exclusion des frères d'un autre module inclus en Smarty inline — test sur le marqueur
  *immédiatement précédent*, pas tout le sous-arbre.** Un `.tpl` peut appeler un *autre*
  module via `{hook h='…'}` directement dans son propre template (pas en PHP
  `fetch()`/`display()`) — invisible à `self::$rpDepth` côté override. Le HTML produit
  contient alors des blocs qui portent leur **propre** marqueur `rp@modules/<autre>/…` mais
  aucun wrap `rp-module` dédié, soit en **frère de premier niveau** du module appelant (ex.
  `tvcmscustomsetting` + widgets wishlist/compare sticky en frères), soit **imbriqué plus
  profondément à l'intérieur d'un seul élément racine** (ex. `ps_customeraccountlinks` qui
  inclut juste un lien `tvcmswishlist` au milieu de son menu compte).
  `isForeignModule(el, ownName)` ne regarde QUE le marqueur `rp@` **immédiatement précédent**
  de `el` en ordre document (même sémantique que l'attribution de `data-source` dans
  `annotateFromComments`, `tpl-annotate.ts`) — pas tout son sous-arbre :
  - un frère de premier niveau directement précédé du marqueur d'un autre module → exclu
    (cas `tvcmscustomsetting`) ;
  - un élément dont le marqueur propre précède, même si un autre module est inclus plus
    profondément à l'intérieur → **gardé tel quel** (cas `ps_customeraccountlinks` — le
    rectangle englobe un peu de contenu étranger mineur plutôt que de disparaître
    entièrement, préférable à l'absence totale de rectangle).
  Un premier essai (`containsForeignModule`) scannait tout le sous-arbre du candidat à la
  recherche d'un marqueur étranger n'importe où dedans — correct pour le cas "frère entier"
  mais excluait à tort un module entier dès qu'il incluait la moindre miette d'un autre
  module imbriqué, même profondément.
- `src/core/inspector/surfaces/module-overlays.ts` (`initModuleOverlaySurface`) : dessine un
  rectangle + label `"<nom> — <durée> ms"` par entrée, dans une couche indépendante
  (`document.body`, `data-pathpicker-ignore`) — pas liée au cycle de vie de l'inspecteur
  (armé/désarmé) : montée/démontée uniquement par le toggle `showModuleOverlay`.
- Ctrl+clic : chaque rectangle porte `data-source` (le `relpath:ligne` du marqueur). Pas de
  logique de clic dédiée — `initClickToSource` (déjà actif globalement, voir `standalone.tsx`)
  gère tout élément `[data-source]` via `closest()`, rectangle inclus.

## Menu "Modules" (clic droit sur un rectangle overlay)

Clic droit sur un rectangle ouvre le menu contextuel habituel (Copier HTML/rendu/
classes/texte/XPath) **plus** une ligne "Modules" dont le survol ouvre un flyout avec,
pour le module cliqué : nom, chemin relatif (`public_html\...`), chemin absolu (disque
hôte complet), URL back-office de configuration (`AdminModules`), et une dernière action
indépendante du module cliqué : **copier l'arbre de tous les modules de la page**.

- Nom/chemins : `moduleDirPath` (`src/core/source/module-overlay.ts`), racine résolue via
  `resolveProjectRoot` (`src/core/dev/project-root.ts`).
- **Hook** (affiché sur le rectangle `"<nom> (<hookName>) — <durée> ms"`, et "Copier le nom
  du hook"/"Copier le lien back-office" dans le flyout) : `Module::fetch()`/`display()`
  (override `Module.php`) ne reçoivent **jamais** le nom du hook — seul `Hook::exec($hook_name, ...)`
  le connaît, juste avant d'appeler la méthode `hookXxx()` du module. Nouvel override
  `override/classes/Hook.php` : surcharge `exec()` pour empiler le hook courant dans une
  pile statique (`$rpHookStack`, signature identique à `HookCore::exec()` — vérifiée dans
  le core avant d'écrire l'override, high-blast-radius sinon : TOUT hook du site passe par
  cette méthode) ; une pile plutôt qu'une simple variable car `exec()` est ré-entrant (un
  hook peut en déclencher un autre via `{hook}` Smarty inline). `Module.php` lit
  `Hook::rpCurrentHookName()` dans `rpFinish()`. Marqueur étendu :
  `rp-module:<nom>:<hookName>:<duréeMs>:<source>` (`hookName` inséré **avant** la durée,
  jamais à la fin, pour ne pas perturber le capture greedy de `source`) — `null` si le
  rendu ne passe pas par `Hook::exec` (override absent/pas encore installé, ou appel
  direct `->fetch()`). Lien back-office : page *Positions* générale
  (`hookPositionsUrl` → `AdminModulesPositions`), pas de deep-link fiable vers un hook
  précis en PrestaShop (pas de paramètre standard, varie selon le thème admin) — le nom du
  hook est copiable séparément pour la recherche manuelle sur cette page.
- URL de config : `moduleConfigUrl` — dossier admin exposé par `renderpicker.php`
  (`Media::addJsDef`, `window.renderPickerAdminDir`) car **`_PS_ADMIN_DIR_` n'existe pas
  côté front** (défini uniquement par le bootstrap `admin/index.php`, jamais chargé sur
  une requête front) ; passé en variable d'env Docker (`PS_ADMIN_DIRNAME`, voir
  `docker/.env` du site, même pattern que `HOST_PUBLIC_HTML_PATH`). Pas de token : calculé
  en contexte front (`Context::employee` est `null` hors back-office), il ne peut
  structurellement pas matcher la session admin réelle — PrestaShop affiche le même
  interstitiel "token invalide, continuer" avec ou sans, inutile de le porter jusque-là.
- Arbre des modules : `buildModuleTree` + `moduleTreeMarkdown` (`module-overlay.ts`), pur.
  Les marqueurs `rp-module` n'exposent **aucune hiérarchie** — juste une liste plate en
  ordre document (ordre du scan `scanModuleOverlays`). L'arbre est reconstruit par
  **confinement géométrique des rectangles** : un module est l'enfant du plus petit autre
  module dont le rectangle le contient entièrement (confinement le plus serré = parent
  direct, pas le plus englobant ; rectangles identiques → pas de parent, anti-boucle).
  Rendu en liste Markdown à puces, 2 espaces d'indentation par niveau :

  ```markdown
  # Modules — /

  - ps_mainmenu
  - tvfooter
    - ps_contactinfo
    - blockreassurance
  ```

  Pensé pour être collé tel quel dans un `.md` — documenter visuellement la structure
  modules d'une page sans avoir à screenshot/lister à la main.

## Perf — render-picker ON = dev-only, pas un proxy de la prod

Mesuré sur un site réel (~137 modules) : render-picker ON ≈ 2,6s/page vs OFF (+ FPC) ≈
0,5s — ~5×. Cause **de loin** dominante, **par design, pas un bug** : `CjFpc::isCacheable()`
(module de cache plein-page tiers) renvoie `false` tant que render-picker est actif →
chaque page est entièrement re-rendue au lieu d'être servie depuis le cache FPC. Normal :
le FPC cacherait sinon des marqueurs dev (durée de rendu, `rp-module`) qui doivent varier à
chaque requête — un cache de ce HTML serait silencieusement faux. **Ne jamais mesurer la
perf prod avec render-picker ON** ; couper (`_RENDER_PICKER_ENABLED_` off) avant toute
mesure ou déploiement.

Second multiplicateur, seulement si Smarty tourne avec `force_compile=1` (mode dev complet,
pas la config par défaut) : le prefilter (`smartyPrefilter`) retourne à **chaque rendu**
au lieu d'une fois par template (compile normalement mis en cache, `compile_check` ne
recompile que les `.tpl` modifiés). `force_compile=1` + prefilter lourd = compile storm à
chaque requête (~8s observé). Pas un problème render-picker en soi — éviter
`force_compile=1` en usage normal (déjà déconseillé, voir `smartyPrefilter` plus haut).

Le coût du prefilter lui-même par ligne de `.tpl` a été réduit : la détection de ligne
ouvrant un tag utilisait 3 `preg_match` (`^\s*<[a-zA-Z]`, exclusion `^\s*</`, exclusion
`^\s*<!--`) — les 2 derniers étaient **du code mort** : un caractère après `<` ne peut pas
être à la fois une lettre (`[a-zA-Z]`, 1er regex) ET `/` ou `!` (ce que les 2 regex suivants
excluaient) — ils étaient donc toujours vrais, jamais réellement évaluateurs. Réduit à 1
seul `preg_match` par ligne, même résultat.

Coût des overrides `Module.php`/`Hook.php` (chronométrage + concat du marqueur + push/pop
du nom de hook) : négligeable, O(1) par module racine/hook, pas la source du ralentissement.
Les `error_log()` de debug (`Module.php`, `rpFinish`) sont gatés derrière
`_RENDER_PICKER_DEBUG_LOG_` (off par défaut) — actifs par défaut, ~137 modules × 2 logs
= 274 écritures synchrones/requête, un coût réel mais secondaire face au FPC.

## Limites connues

- Précision **ligne d'ouverture du tag** uniquement, pas colonne.
- Tag ouvrant au milieu d'une ligne (pas en 1ère position) ou dans `<script>`/`<style>`/
  `<pre>`/`<textarea>` → pas de marqueur ; l'élément hérite du marqueur précédent
  (rare, cosmétique).
- Marqueurs gravés au premier compile → un changement de `.tpl` est repris par
  `compile_check` automatiquement, mais **activer le module** nécessite un vidage de
  cache manuel une fois (templates déjà compilés sans marqueur).
- Ciblé PrestaShop **1.7.x** / Smarty 3 (API testées : hook
  `actionFrontControllerSetMedia`, `displayFooter`, `Media::addJsDef`,
  `smarty->registerFilter('pre', …)`).
