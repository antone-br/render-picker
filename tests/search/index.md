# Tests — `search/` ↔ `src/core/search/`

> Recherche d'éléments par tag / classe / sélecteur CSS (finder).

| Fichier                    | Module testé                          | Couvre                                                                                     |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `element-search.test.ts`   | `src/core/search/element-search.ts`   | `toSelector` (tag/classe/CSS/invalides, multi-classes `p-4 space-y-4` → `.a.b`), `searchElements` (multi-classes ET, exclusion UI hôte, cap, ordre). |
| `highlight.test.ts`        | `src/core/search/highlight.ts`        | Couche highlight (rects de survol), style actif, pooling au refetch, clear/destroy + rAF.    |
| `query-history.test.ts`     | `src/core/search/query-history.ts`    | Undo/redo des requêtes : push (no-op identique, tronque le redo), bornes, cap 100.           |
