# Tests — `source/` ↔ `src/core/source/`

> Résolution de la source React : annotation fiber, enrichissement du PickResult, décodage sourcemap.
> `fetch` mocké (`vi.stubGlobal`) — jamais d'appel réseau réel.

| Fichier                        | Module testé                             | Couvre                                                                                           |
| ------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `component-annotate.test.ts`   | `src/core/source/component-annotate.ts`  | `annotate` : `data-source` (élément) + `data-owner-source` (usage via `_debugOwner`, frames nommés ET anonymes) ; `extractDirectSources` (frames Webpack dev : webpack-internal, backslashes/crochets, skip node_modules, ordre) + `data-source` Webpack sans sourcemap ; `componentChain` (chaîne owners externe→interne, dédup, cap, fallback nom unique). |
| `enrich.test.ts`               | `src/core/source/enrich.ts`              | `findPickedElement` + `enrichResult` : complétion depuis `data-source` / `data-component` ; `reactComponent` = chaîne de composants quand la fibre est présente. |
| `source-map-resolver.test.ts`  | `src/core/source/source-map-resolver.ts` | `normalizeSourcePath` + `resolvePosition` : décodage VLQ (maps plain + index Turbopack).         |
