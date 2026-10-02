# Tests — `inspector/` ↔ `src/core/inspector/`

> Moteur d'inspection (sans React) : hit-test, cycle de vie, sélecteurs, hotkey.
> Sous-dossier `surfaces/` → voir `surfaces/index.md`.

| Fichier                 | Module testé                         | Couvre                                                                                        |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `hit-test.test.ts`      | `src/core/inspector/hit-test.ts`     | `shouldIgnore` / `containsPoint` / `resolveTarget` (stub `elementFromPoint`, arrêt sur disabled). |
| `inspector.test.ts`     | `src/core/inspector/inspector.ts`    | `createInspector` : montage/cleanup, Échap → onCancel, pick simple, Maj+clic → onPickMany.    |
| `css-selector.test.ts`  | `src/core/inspector/css-selector.ts` | `getElementSelector` + `getCssSelector` : id, classes hash filtrées, `:nth-child`, unicité.   |
| `hotkey.test.ts`        | `src/core/inspector/hotkey.ts`       | `matchesHotkey` (combos) + `createHotkeyMatcher` (double-tap, fenêtre, reset).                |
| `xpath.test.ts`         | `src/core/inspector/xpath.ts`        | `getXPath` : id, index des frères, SVG, préfixe `/html/`.                                     |
