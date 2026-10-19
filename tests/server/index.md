# Tests — `server/` ↔ `src/server/`

> Code Node de la route dev (jamais bundlé navigateur). Effets système injectés (`LaunchDeps`) : aucun vrai process lancé.

| Fichier                  | Module testé                     | Couvre                                                                                                                                         |
| ------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `launch-editor.test.ts`  | `src/server/launch-editor.ts`    | `editorArgs` (VS Code `-r -g`, Zed `f:l:c`, JetBrains `--line/--column`, sans ligne) + `findRunningEditor` (exe lancé, casse) + `launchEditor` : exe Windows déjà ouvert, cache (1 seule liste des process), CLI du PATH, macOS `open -na <App>.app`, échec → `false`. |
