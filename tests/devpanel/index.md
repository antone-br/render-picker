# Tests — `devpanel/` ↔ `src/core/devpanel/`

> Moteur du panneau d'inspection : buffers + capture console/network (sans React).

| Fichier                      | Module testé                              | Couvre                                                              |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `store.test.ts`              | `src/core/devpanel/store.ts`              | `addLog`/`addRequest`/`clear*`/`getState`, ring (cap 500), `subscribe`. |
| `console-capture.test.ts`    | `src/core/devpanel/console-capture.ts`    | Patch `console.*` → entrées (texte sérialisé) + délégation, restaure au cleanup. |
| `network-capture.test.ts`    | `src/core/devpanel/network-capture.ts`    | Patch `fetch` (succès/erreur) → entrée {method,url,status,ok,durationMs}, restaure. |
| `console-eval.test.ts`       | `src/core/devpanel/console-eval.ts`       | `runConsoleExpression` : écho + résultat via `console.*`, portée globale, erreur, promesse, vide. |
| `dom-tree.test.ts`           | `src/core/devpanel/dom-tree.ts`           | `nodeLabel` / `isElementSkippable` / `visibleChildren` / `inlineText` / `ancestorsUpTo` (exclut l'UI, texte borné, chaîne d'ancêtres). |
| `inspected.test.ts`          | `src/core/devpanel/inspected.ts`          | Store élément inspecté : set/get, notification des abonnés, désabonnement. |
