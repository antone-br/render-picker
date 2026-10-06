# Tests — `devpanel/` ↔ `src/core/devpanel/`

> Moteur du panneau d'inspection : buffers + capture console/network (sans React).

| Fichier                      | Module testé                              | Couvre                                                              |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `store.test.ts`              | `src/core/devpanel/store.ts`              | `addLog`/`addRequest`/`clear*`/`getState`, ring (cap 500), `subscribe`. |
| `console-capture.test.ts`    | `src/core/devpanel/console-capture.ts`    | Patch `console.*` → entrées (texte sérialisé) + délégation, restaure au cleanup. |
| `network-capture.test.ts`    | `src/core/devpanel/network-capture.ts`    | Patch `fetch` (succès/erreur) → entrée {method,url,status,ok,durationMs}, restaure. |
