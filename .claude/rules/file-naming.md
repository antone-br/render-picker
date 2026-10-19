# Convention de nommage des fichiers

## Nommage dans le code

- **Variables et fonctions : `camelCase`** (`getXPath`, `resolveTarget`, `makeQueryHistory`).
- **Constantes de module** : `UPPER_SNAKE_CASE` (`UI_Z`, `SOLID_BG`, `MAX_HISTORY`).
- **Composants, types, interfaces : `PascalCase`** (`SettingsBar`, `PickResult`).
- Fabriques : préfixe `create*` / `make*` (`createInspector`, `makeQueryHistory`) ; initialiseurs avec effets de bord : `init*` (`initClickToSource`) — ils retournent un `dispose`.

```ts
// ✅ Correct
const queryHistory = makeQueryHistory("div");

// ❌ Incorrect
const query_history = makeQueryHistory("div");
```

---

## Extensions

| Extension | Quand l'utiliser                                                        |
| --------- | ----------------------------------------------------------------------- |
| `.tsx`    | Fichiers contenant du JSX (composants React, entrées React).            |
| `.ts`     | Sans JSX (core, hooks React, constantes, types, helpers, entrées Node). |

---

## Kebab-case et noms courts contextualisés

Tous les fichiers et dossiers sont en `kebab-case`. Le nom est **le plus court possible** en s'appuyant sur le dossier parent — on ne répète pas le nom du dossier.

```
// ✅ Correct
src/ui/search/popover.tsx
src/ui/search/results.tsx
src/ui/settings-menu/rows.tsx
src/core/inspector/surfaces/tooltip.ts

// ❌ Incorrect — redondant avec le dossier parent
src/ui/search/search-popover.tsx
src/ui/settings-menu/settings-menu-rows.tsx
src/core/inspector/surfaces/surface-tooltip.ts
```

Exception tolérée : le fichier principal d'un widget porte le nom du dossier (`ui/dev-panel/dev-panel.tsx`, `ui/html-tree/html-tree.tsx`, `ui/settings-menu/settings-menu.tsx`) — c'est ce qui permet de l'importer sans `index.ts`.

Les noms dupliqués entre dossiers ne posent pas de problème (`ui/tooltip.tsx` et `core/inspector/surfaces/tooltip.ts`).

---

## Fichiers interdits

### `index.ts` / `index.tsx`

**Interdits**, sauf **`src/index.ts`** (entrée `"."` du package, exigée par `package.json#exports`). Aucun barrel de réexport dans `core/` ou `ui/` : chaque fichier est importé par son nom.

---

## Types

- Types partagés par plusieurs modules : `src/core/types.ts`.
- Un type propre à un module vit dans ce module.

---

## Hooks React

Préfixe `use-`, nom court : `use-render-picker.ts`, `use-outside-close.ts`, `ui/dev-panel/use-drag-resize.ts`. Voir `.claude/rules/react-hooks.md`.

---

## Constantes

Pures valeurs dans `src/core/inspector/constants/<domaine>.ts` : `theme.ts` (palette), `picker.ts` (overlay, z-index), `layout.ts`, `behavior.ts` (attributs, timings). Un fichier `styles.ts` local est accepté pour les styles d'un widget (`ui/dev-panel/styles.ts`).

---

## Fichiers de tests

Même nom que le module testé + `.test.ts` / `.test.tsx` :

```
src/core/search/query-history.ts → tests/search/query-history.test.ts
src/react.tsx                    → tests/react.test.tsx
```

Emplacement : voir `.claude/rules/test-structure.md`.

---

## Résumé

| Type              | Nommage                               | Exemple                    |
| ----------------- | ------------------------------------- | -------------------------- |
| Composant React   | kebab-case, court                     | `popover.tsx`, `nav.tsx`   |
| Widget principal  | nom du dossier                        | `dev-panel/dev-panel.tsx`  |
| Hook React        | `use-` + nom court                    | `use-drag-resize.ts`       |
| Module core       | kebab-case, ce qu'il fait             | `hit-test.ts`, `xpath.ts`  |
| Types partagés    | `core/types.ts`                       | `types.ts`                 |
| Constantes        | domaine dans `constants/`             | `theme.ts`, `picker.ts`    |
| Test              | module + `.test`                      | `xpath.test.ts`            |

---

## Anti-patterns

- `camelCase` / `PascalCase` dans un nom de fichier ou de dossier.
- Répéter le nom du dossier parent (`search/search-results.tsx`).
- Créer un `index.ts` hors de `src/index.ts`.
- Un test nommé autrement que son module (`tests/search/history.test.ts` pour `query-history.ts`).
