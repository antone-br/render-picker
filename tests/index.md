# Index des tests

> Vitest + jsdom. Un fichier de test par module de `src/` (voir `.claude/rules/tests.md`).
> Tests à plat dans `tests/` (noms de modules uniques), même si les modules sont dans des sous-dossiers de `src/core/`.
> Mettre cet index à jour à **chaque** ajout, suppression ou changement de portée d'un fichier de test.

| Fichier                         | Module testé                              | Couvre                                                                                      |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `client.test.ts`                | `src/client.ts`                           | `initRenderPicker` : montage, no-op en production, cleanup des listeners/patchs.            |
| `click-to-source.test.ts`       | `src/core/dev/click-to-source.ts`         | `buildVscodeUri` (pure) + `initClickToSource` (Ctrl+clic → URI VS Code, cleanup listener).  |
| `css-selector.test.ts`          | `src/core/inspector/css-selector.ts`      | `getElementSelector` + `getCssSelector` : id, classes hash filtrées, `:nth-child`, unicité. |
| `enrich.test.ts`                | `src/core/source/enrich.ts`               | `findPickedElement` + `enrichResult` : complétion depuis `data-source` / `data-component`.  |
| `hit-test.test.ts`              | `src/core/inspector/hit-test.ts`          | `shouldIgnore` / `containsPoint` / `resolveTarget` (stub `elementFromPoint`).               |
| `hotkey.test.ts`                | `src/core/inspector/hotkey.ts`            | `matchesHotkey` (combos) + `createHotkeyMatcher` (double-tap, fenêtre, reset).              |
| `inspector.test.ts`             | `src/core/inspector/inspector.ts`         | `createInspector` : montage/cleanup, Échap → onCancel, pick simple, Maj+clic → onPickMany.  |
| `source-map-resolver.test.ts`   | `src/core/source/source-map-resolver.ts`  | `normalizeSourcePath` + `resolvePosition` : décodage sourcemap VLQ (`fetch` mocké).         |
| `surfaces.test.ts`              | `src/core/inspector/surfaces.ts`          | `tooltipText` (composant d'abord, `· disabled`, `· selected #n`) + `hudText` (3 états).     |
| `xpath.test.ts`                 | `src/core/inspector/xpath.ts`             | `getXPath` : id, index des frères, SVG, préfixe `/html/`.                                   |
| `react.test.tsx`                | `src/react.tsx`                           | `formatResult` / `formatResults` (pures) + `RenderPickerButton` (rendu, hints, sélection).  |
