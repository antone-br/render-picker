# Tests — `dev/` ↔ `src/core/dev/`

> Utilitaires dev : redirection clic → VS Code. (`console-hush.ts` non testé.)

| Fichier                 | Module testé                      | Couvre                                                                                            |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `click-to-source.test.ts` | `src/core/dev/click-to-source.ts` | `buildVscodeUri` (pure) + `initClickToSource` : Ctrl+clic → `data-source`, Alt+clic → `data-owner-source`, cleanup listener. |
