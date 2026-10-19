# render-picker — Architecture & Conventions

> Règles structurelles, stack, découpage en couches, checklist de fin de tâche.
> Lib npm (`@antone-br/render-picker`) + extension Chrome (`extension/`). Pas d'application Next.

---

## Stack technique

- **TypeScript strict** (`tsconfig.json`) : `strict`, `noUncheckedIndexedAccess`, `isolatedModules`, `moduleResolution: "Bundler"`.
- **Build** : `tsup` (`tsup.config.ts`) → ESM + CJS + `.d.ts`, cible `es2020`.
  - `react`, `react-dom`, `next` sont **external** (peer deps) — jamais bundlés.
  - Banner `"use client"` ajouté sur les entrées navigateur (`index`, `client`, `react`) ; `next.ts` (helper Node) n'en a pas.
- **Tests** : Vitest + jsdom (`vitest.config.ts`) — voir `.claude/rules/tests.md`.
- **Extension** : esbuild (`extension/build.mjs`, `npm run ext:build`), réutilise `src/core` et `src/ui`.
- **Zéro dépendance runtime** : `dependencies` reste vide. Tout le moteur (hit-test, overlay, XPath, CSS, hotkey, sourcemaps) est écrit à la main.

---

## Arborescence

```
src/
  index.ts            ← entrée "." : réexporte client + react
  client.ts           ← entrée "./client" : initRenderPicker + exports bas niveau
  react.tsx           ← entrée "./react" : RenderPickerButton, formatResult(s), useRenderPicker
  next.ts             ← entrée "./next" : withRenderPicker + handlers GET/POST (Node)
  server/             ← code Node de la route dev (launch-editor) — importé par next.ts SEUL
  core/               ← moteur SANS React (DOM pur, fonctions pures)
    types.ts          ← types partagés (PickResult, InspectorCallbacks…)
    format.ts · settings.ts · computed-html.ts
    inspector/        ← hit-test, inspector, hotkey, key-command, xpath, css-selector
      constants/      ← behavior, layout, picker, theme (pures valeurs)
      surfaces/       ← overlay, tooltip, markers, decorations (DOM impératif)
    search/           ← element-search, highlight, query-history
    source/           ← component-annotate, enrich, source-map-resolver
    devpanel/         ← capture console/réseau, store, dom-tree, panel-state
    dev/              ← click-to-source, console-hush
  ui/                 ← composants et hooks React
    dev-panel/ · html-tree/ · search/ · settings-menu/   ← un dossier par widget
    context-menu.tsx · tooltip.tsx · icons.tsx · …       ← widgets mono-fichier
extension/
  src/entries/        ← background, content, main-world, options
  src/ui/             ← root, options-page
tests/                ← miroir de src/core (voir test-structure.md)
```

---

## Règles structurelles

1. **`src/core/` n'importe jamais React ni `src/ui/`.** Le core est consommable par l'extension (content script, shadow DOM) et testable sans React.
2. **`src/ui/` consomme le core**, jamais l'inverse. La logique non visuelle d'un widget descend dans `core/` (ex. `core/search/query-history.ts` pour l'undo de `ui/search/popover.tsx`).
3. **Un widget multi-fichiers = un dossier** dans `ui/` (`ui/search/`, `ui/dev-panel/`). Un widget mono-fichier reste à la racine de `ui/`.
4. **Constantes** : pures valeurs dans `core/inspector/constants/<domaine>.ts` (`theme.ts`, `picker.ts`, `layout.ts`, `behavior.ts`). Pas de couleur, z-index ou délai en dur dans un composant.
5. **Types partagés** dans `core/types.ts` ; un type utilisé dans un seul fichier reste dans ce fichier.
6. **API publique = les 4 entrées** (`index`, `client`, `react`, `next`) déclarées dans `package.json#exports`. Toute nouvelle API publique passe par l'une d'elles et est documentée dans `README.md`.
7. **Dev-only** : `initRenderPicker` et `withRenderPicker` sont no-op quand `NODE_ENV === "production"`. Les handlers `GET`/`POST` de `next.ts` aussi.
8. **`src/server/` = Node only** (`child_process`, `fs`) : importé uniquement par `src/next.ts`, jamais par `core/`, `ui/` ni les entrées navigateur (vérifier qu'aucun `dist/*.js` hors `next` ne contient `child_process`).
9. **Ne jamais exposer le chemin projet en prod** (`NEXT_PUBLIC_PROJECT_ROOT` injecté uniquement hors production).
10. **Cleanup obligatoire** : toute fonction `init*` / `create*` qui pose un listener, un observer ou un patch (console, fetch, XHR) retourne un `dispose` qui retire tout.
11. **Surfaces de l'inspecteur ignorées par le hit-test** : tout élément injecté (overlay, tooltip, UI React, portals) porte l'attribut d'exclusion `data-pathpicker-ignore` (`IGNORE_ATTR` dans `core/inspector/constants/behavior.ts`) pour ne jamais être pické.

---

## Anti-patterns

- ❌ Ajouter une dépendance runtime (`dependencies`) — implémenter en interne ou passer en peer optionnelle.
- ❌ Importer `react` / `src/ui` depuis `src/core`.
- ❌ Couleurs, z-index, timings en dur dans un composant au lieu de `core/inspector/constants/*`.
- ❌ Listener / `MutationObserver` / patch global sans dispose.
- ❌ Code qui tourne en production (logs, annotation DOM, lecture du project root).
- ❌ Laisser des fichiers morts (stubs, anciens modules après refactor).
- ❌ Nouvelle fonctionnalité sans test (voir `.claude/rules/tests.md`).

---

## Checklist avant fin de tâche

Toute modification de code se termine par ces vérifications. **Aucune exception.**

1. **`npm run typecheck`** — zéro erreur TypeScript.
2. **`npm test`** — tous les tests passent. Nouvelle logique → test du cas nominal.
3. **`npm run ext:build`** — si `extension/` ou du code partagé consommé par l'extension a changé.
4. **`index.md` des tests** — mettre à jour l'`index.md` du dossier de tests concerné (voir `.claude/rules/test-structure.md`).
5. **`README.md`** (et `extension/README.md`) — si l'API publique, une option, un geste ou un raccourci change.

```bash
npm run typecheck
npm test
npx vitest run tests/search      # un dossier
npm run ext:build
```

---

## Renommage et cleanup

- Un fichier mal nommé est renommé immédiatement (voir `.claude/rules/file-naming.md`).
- Après suppression ou déplacement de fichiers : `npm run typecheck` + `npm run build` pour attraper les imports cassés.
- Un test suit son module : renommer / déplacer le module ⇒ renommer / déplacer le test et mettre à jour les `index.md`.
