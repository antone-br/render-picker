# render-picker

Dev-only toolkit for **Next.js + React 19**: click any element and get a clipboard-ready
snippet for your AI agent — route, XPath, CSS selector, React component **and its source
`file:line`** — plus **Ctrl+click to open the source in VS Code** (and **Alt+click to jump to
the usage site** — where a shared component is written, not its definition).

```
[renderPicker]
Route: /dashboard
XPath: /html/body/main/section
CSS: main > section
Source: src/components/dashboard-card.tsx:42
React: DashboardCard
```

The picking engine is fully self-contained (no runtime dependency): hit-test, overlay, hover
tooltip, multi-selection, XPath/CSS generation and the arming hotkey all live in `src/core/`.
React 19 removed `_debugSource`, so the source `file:line` can't be read from the picked element
alone. `render-picker` annotates the DOM with `data-component` / `data-source`, resolved at runtime
from React's `_debugStack` through the dev chunks' sourcemaps (plain and index maps, Turbopack
included), and merges that into the pick output.

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

Props: `pathname`, `color`, `hotkey` (default `"shift shift"` — double-tap Shift), `multi`
(default `true`), `onPick`, `onPickMany`. Custom `onPick` / `onPickMany` receive the
already-enriched results and the formatted text. The copied text and the button tooltip use the
`[renderPicker]` prefix; `formatResult` / `formatResults` (and the `useRenderPicker` hook) are
exported from `@antone-br/render-picker/react` to build the same text or wire your own trigger.

### `withRenderPicker(nextConfig)`

Adds `env.NEXT_PUBLIC_PROJECT_ROOT = process.cwd()` outside production. Accepts a config object or
function. If a `render-picker.config.json` exists at the project root, it is also injected as
`NEXT_PUBLIC_RENDER_PICKER_CONFIG` (dev only).

### Settings — remappable commands

Layout overlays (padding / gap / margin) are **always on** when hovering while armed — no toggle.

The settings dropdown (gear) holds a **Commands** accordion to remap every shortcut: the arm hotkey
(default double `Shift`), the mouse gestures — **Copy** (default click), **Copy raw HTML**
(default right-click, copies `outerHTML`), **Multi-select** (default `Shift`+click), **Open source**
(default `Ctrl`+click), **Open usage** (default `Alt`+click), each a *modifier* + *click type*
(click / right-click / double-click) — and the keyboard keys **Confirm** (default `Enter`) and
**Cancel** (default `Esc`). `Esc` always disarms as a safety net.

Choices are saved to `localStorage` by default. To persist them to a committable
**`render-picker.config.json`** at the project root, add a dev API route (one line) — changes then
write the file (GET reads it back):

```ts
// app/api/render-picker/route.ts
export { GET, POST } from "@antone-br/render-picker/next";
```

```json
// render-picker.config.json (written/read by the route)
{
  "commands": {
    "arm": "shift shift",
    "copy": { "modifier": "none", "trigger": "click" },
    "copyHtml": { "modifier": "none", "trigger": "rightclick" },
    "multi": { "modifier": "shift", "trigger": "click" },
    "confirm": "enter",
    "cancel": "escape",
    "source": { "modifier": "ctrl", "trigger": "click" },
    "usage": { "modifier": "alt", "trigger": "click" }
  }
}
```

Without the route, changes stay in `localStorage` (no crash). The handlers are no-ops in production.

### Lower-level exports (`@antone-br/render-picker/client`)

`enrichResult`, `findPickedElement`, `annotate`, `annotateTree`, `componentInfo`,
`initComponentAnnotator`, `initClickToSource`, `buildVscodeUri`, `hushConsoleNoise`,
`resolvePosition`, `normalizeSourcePath`, `loadSettings`, `saveSettings`.

## Limitations

- Next.js dev builds only: source resolution reads `/_next/static/chunks/*._.js` frames and their
  sourcemaps.
- Never ships the project path to production: both `withRenderPicker` and `initRenderPicker` are
  no-ops when `NODE_ENV === "production"`.

## License

MIT
