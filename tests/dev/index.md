# Tests — `dev/` ↔ `src/core/dev/`

> Utilitaires dev : redirection clic → éditeur (10 IDE). (`console-hush.ts` non testé.)

| Fichier                 | Module testé                      | Couvre                                                                                            |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `click-to-source.test.ts` | `src/core/dev/click-to-source.ts` | `buildVscodeUri` (pure) + `initClickToSource` : Ctrl+clic → `data-source`, Alt+clic → `data-owner-source`, éditeur choisi (`commands.editor` → URI WebStorm), route dev d'abord (`POST { open }` OK → pas de lien ; route absente / 500 → repli sur le lien), cleanup listener. |
| `editors.test.ts` | `src/core/dev/editors.ts` | `EDITORS` (10 ids uniques) + `isEditorId` + `buildEditorUri` : famille VS Code (5 schémas, colonne), Zed (sans double slash posix), JetBrains (`open?file=` encodé, line/column), sans ligne, racine/source absente → null. |
