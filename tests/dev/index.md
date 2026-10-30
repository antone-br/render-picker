# Tests — `dev/` ↔ `src/core/dev/`

> Utilitaires dev : redirection clic → éditeur (10 IDE). (`console-hush.ts` non testé.)

| Fichier                 | Module testé                      | Couvre                                                                                            |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `click-to-source.test.ts` | `src/core/dev/click-to-source.ts` | `buildVscodeUri` (pure) + `initClickToSource` : Alt+clic → `data-source` (picker armé ou non), Ctrl+clic → `data-owner-source` (usage, **picker armé uniquement** — `PICKER_ARMED`), Ctrl+clic picker désarmé → n'ouvre rien, éditeur choisi (`commands.editor` → URI WebStorm), route dev d'abord (`POST { open }` OK → pas de lien ; route absente / 500 → repli sur le lien), `useRoute=false` → lien URI direct sans fetch, cleanup listener. |
| `editors.test.ts` | `src/core/dev/editors.ts` | `EDITORS` (10 ids uniques) + `isEditorId` + `buildEditorUri` : famille VS Code (5 schémas, colonne), Zed (sans double slash posix), JetBrains (`open?file=` encodé, line/column), sans ligne, racine/source absente → null. |
| `project-root.test.ts` | `src/core/dev/project-root.ts` | `resolveProjectRoot` : priorité `localStorage` > `window.renderPickerRoot` (jsDef) > `<meta>` > `none` (override chemin hôte en Docker). |
