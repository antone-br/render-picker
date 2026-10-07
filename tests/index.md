# Index des tests

> Vitest + jsdom. Un fichier de test par module de `src/` (voir `.claude/rules/tests.md` et `.claude/rules/test-structure.md`).
> **Arborescence miroir de `src/`**. Un `index.md` **par dossier** décrit ses tests ; celui-ci couvre la racine + renvoie aux sous-dossiers.
> Mettre l'`index.md` du dossier concerné à jour à **chaque** ajout, suppression ou changement de portée d'un fichier de test.

## Racine — entrées + modules racine du core

| Fichier            | Module testé                                        | Couvre                                                                                      |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `client.test.ts`   | `src/client.ts`                                     | `initRenderPicker` : montage, no-op en production, cleanup des listeners/patchs.            |
| `next.test.ts`     | `src/next.ts`                                        | `withRenderPicker` + handlers `GET`/`POST` (écriture `render-picker.config.json`, dev only). |
| `settings.test.ts` | `src/core/settings.ts`                              | `loadSettings` / `saveSettings` : défauts, localStorage, priorité fichier racine (env), bindings search/inspect (modificateur + touche + double-tap, normalisation legacy string). |
| `react.test.tsx`   | `src/react.tsx` · `src/ui/*` · `src/core/format.ts` | `formatResult` / `formatResults` (pures) + `RenderPickerButton` (rendu, hints, sélection, menu : deux dropdowns search/inspect, search global Ctrl + F F non armé).  |

## Sous-dossiers (miroir de `src/core/`)

| Dossier                 | Correspond à                         | Index                             |
| ----------------------- | ------------------------------------ | --------------------------------- |
| `inspector/`            | `src/core/inspector/`                | [`inspector/index.md`](inspector/index.md) |
| `inspector/surfaces/`   | `src/core/inspector/surfaces/`       | [`inspector/surfaces/index.md`](inspector/surfaces/index.md) |
| `source/`               | `src/core/source/`                   | [`source/index.md`](source/index.md) |
| `dev/`                  | `src/core/dev/`                      | [`dev/index.md`](dev/index.md)    |
| `devpanel/`             | `src/core/devpanel/`                 | [`devpanel/index.md`](devpanel/index.md) |
| `search/`               | `src/core/search/`                   | [`search/index.md`](search/index.md) |
