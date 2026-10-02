# Tests — `source/` ↔ `src/core/source/`

> Résolution de la source React : annotation fiber, enrichissement du PickResult, décodage sourcemap.
> `fetch` mocké (`vi.stubGlobal`) — jamais d'appel réseau réel.

| Fichier                        | Module testé                             | Couvre                                                                                           |
| ------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `component-annotate.test.ts`   | `src/core/source/component-annotate.ts`  | `annotate` : `data-source` (élément) + `data-owner-source` (usage via `_debugOwner`, frames nommés ET anonymes). |
| `enrich.test.ts`               | `src/core/source/enrich.ts`              | `findPickedElement` + `enrichResult` : complétion depuis `data-source` / `data-component`.       |
| `source-map-resolver.test.ts`  | `src/core/source/source-map-resolver.ts` | `normalizeSourcePath` + `resolvePosition` : décodage VLQ (maps plain + index Turbopack).         |
