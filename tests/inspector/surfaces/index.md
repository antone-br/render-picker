# Tests — `inspector/surfaces/` ↔ `src/core/inspector/surfaces/`

> Surfaces DOM flottantes de l'inspecteur : tooltip, décorations layout, overlay de survol.
> Limites jsdom : géométrie fine stubée (`getBoundingClientRect`, `Range`, `getComputedStyle`).

| Fichier                | Module testé                                 | Couvre                                                                 |
| ---------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| `tooltip.test.ts`      | `src/core/inspector/surfaces/tooltip.ts`     | `tooltipTitle` / `tooltipMetrics` (px) / `dimsText`.                   |
| `decorations.test.ts`  | `src/core/inspector/surfaces/decorations.ts` | `renderDecorations` : padding (div bordé, radius), gap (bandes consécutives + pointillé). |
| `overlay.test.ts`      | `src/core/inspector/surfaces/overlay.ts`     | `positionOverlay` : glisse (transition) / instantané.                 |
