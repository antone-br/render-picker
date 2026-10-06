# Tests — `search/` ↔ `src/core/search/`

> Recherche d'éléments par tag / classe / sélecteur CSS (finder).

| Fichier                    | Module testé                          | Couvre                                                                                     |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `element-search.test.ts`   | `src/core/search/element-search.ts`   | `toSelector` (tag/classe/CSS/invalides), `searchElements` (exclusion UI hôte, cap, ordre).   |
