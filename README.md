# render-picker

Dev-only toolkit for **Next.js + React 19**: click any element and get a clipboard-ready
snippet for your AI agent — route, XPath, CSS selector, React component **and its source
`file:line`** — plus **Ctrl+click to open the source in VS Code**.

```
[renderPicker], Origin: http://localhost:3000, Project: my-app, Route: /dashboard, XPath: /html/body/main/section, CSS: main > section, React: DashboardCard (src/components/dashboard-card.tsx:42)
```

Built on [`react-path-picker`](https://github.com/kiboko-ai/react-path-picker) (MIT, by Kiboko AI)
for the picking UI. React 19 removed `_debugSource`, so the picker alone can no longer tell you the source
file. `render-picker` annotates the DOM with `data-component` / `data-source`, resolved at runtime
from React's `_debugStack` through the dev chunks' sourcemaps (plain and index maps, Turbopack
included), and feeds that back into the picker output.

## Install

```bash
npm install @antone-br/render-picker
```

## Setup (Next.js App Router)

**1. `next.config.mjs`** — exposes the absolute project root to the client, dev only:

```js
import { withRenderPicker } from "@antone-br/render-picker/next";

export default withRenderPicker({
  // your config
});
```

**2. `src/instrumentation-client.ts`** — DOM annotation, Ctrl+click → VS Code, console hush:

```ts
import { initRenderPicker } from "@antone-br/render-picker/client";

initRenderPicker();
```

**3. Picker button** — mount once in your root layout:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { RenderPickerButton } from "@antone-br/render-picker/react";

export function DevRenderPicker() {
  const pathname = usePathname();
  if (process.env.NODE_ENV === "production") return null;
  return <RenderPickerButton pathname={pathname} project="my-app" />;
}
```

## Usage

| Gesture | Effect |
|---|---|
| Double-tap `Shift` or click the aim icon | Arm the picker |
| Click | Copy one element and close |
| `Shift`+click, then `Enter` | Copy several elements at once |
| `Esc` | Cancel |
| `Ctrl`+click (picker off) | Open the element's source in VS Code |

## API

### `initRenderPicker(options?) => dispose`

| Option | Type | Default | |
|---|---|---|---|
| `enabled` | `boolean` | `NODE_ENV !== "production"` | Master switch |
| `projectRoot` | `string` | `process.env.NEXT_PUBLIC_PROJECT_ROOT` | Absolute root used for `vscode://file/…` |
| `clickToSource` | `boolean` | `true` | Ctrl+click → VS Code |
| `annotate` | `boolean \| { delayMs }` | `true`, `2000` ms | Annotation starts after hydration to avoid attribute mismatches |
| `hushConsole` | `boolean \| RegExp[]` | `true` | Drops "Download the React DevTools", `[HMR] connected`, `[Fast Refresh]` logs |

Returns a function that removes every listener, observer and console patch.

### `<RenderPickerButton>`

Same props as `PathPickerButton` (`pathname`, `project`, `color`, `hotkey`, `multi`, `onPick`,
`onPickMany`). Custom `onPick` / `onPickMany` receive the already-enriched results and formatted text.
The copied text and the button tooltip use the `[renderPicker]` prefix; `formatResult` /
`formatResults` are exported from `@antone-br/render-picker/react` to build the same text yourself.

### `withRenderPicker(nextConfig)`

Adds `env.NEXT_PUBLIC_PROJECT_ROOT = process.cwd()` outside production. Accepts a config object or
function.

### Lower-level exports (`@antone-br/render-picker/client`)

`enrichResult`, `findPickedElement`, `annotate`, `annotateTree`, `componentInfo`,
`initComponentAnnotator`, `initClickToSource`, `buildVscodeUri`, `hushConsoleNoise`,
`resolvePosition`, `normalizeSourcePath`.

## Limitations

- Next.js dev builds only: source resolution reads `/_next/static/chunks/*._.js` frames and their
  sourcemaps.
- Never ships the project path to production: both `withRenderPicker` and `initRenderPicker` are
  no-ops when `NODE_ENV === "production"`.

## License

MIT
