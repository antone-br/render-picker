# Imports

## Relatifs uniquement

Le projet n'a **aucun alias** (`@/…`) : `tsup`, `esbuild` (extension) et Vitest résolvent les chemins relatifs sans configuration. On n'en ajoute pas.

```ts
// ✅ src/ui/dev-panel/dev-panel.tsx
import { UI_Z } from "../../core/inspector/constants/picker";
import { HtmlTree } from "../html-tree/html-tree";
import { ConsoleTab } from "./console-tab";

// ❌ Alias inexistant
import { UI_Z } from "@/core/inspector/constants/picker";
```

L'extension importe le code partagé de la même façon (`extension/src/entries/content.tsx` → `../../../src/core/...`).

---

## Sens des dépendances

```
entrées (client, react, next, index)  →  ui  →  core
extension                             →  ui  →  core
```

- `src/core/` n'importe **jamais** `react`, `react-dom` ni `src/ui/`.
- `src/next.ts` (Node) n'importe rien de navigateur (DOM, React).
- Pas d'import circulaire entre modules.

---

## Ordre des imports

Un groupe par bloc, séparé par une ligne vide :

1. **Externes** (`react`, `react-dom`, `node:*`).
2. **Core** (`../core/...`, `../../core/...`).
3. **Locaux** (`../<widget>/...` puis `./...`).

```ts
import { useEffect, useLayoutEffect, useRef, useState, type FC, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { UI_Z } from "../core/inspector/constants/picker";
import { BTN_SHADOW, SOLID_BG } from "../core/inspector/constants/theme";

import { GearIcon, PanelIcon, SearchIcon } from "./icons";
```

---

## Imports de types

Un import qui ne sert qu'au typage utilise `import type`, ou le modificateur inline `type` quand il est mélangé à des valeurs (`isolatedModules` l'exige).

```ts
// ✅
import type { RenderPickerSettings } from "../core/settings";
import { useEffect, type FC } from "react";

// ❌ si RenderPickerSettings n'est utilisé que comme type
import { RenderPickerSettings } from "../core/settings";
```

---

## Anti-patterns

- Ajouter un alias de chemin dans `tsconfig.json`.
- Importer `src/ui` ou `react` depuis `src/core`.
- Passer par `src/index.ts` (ou une autre entrée) pour importer un module interne : importer le fichier source directement.
- Mélanger les groupes sans ligne vide.
