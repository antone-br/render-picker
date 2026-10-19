# Composants React

## Déclaration : `FC<Props>`

Les composants s'écrivent en **`export const X: FC<XProps>`**, props destructurées en paramètre.

```tsx
import type { FC } from "react";

export interface SearchNavProps {
  counter: string;
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export const SearchNav: FC<SearchNavProps> = ({ counter, disabled, onPrev, onNext }) => (
  ...
);
```

Composant sans props : `export const HtmlTree: FC = () => { ... }`.

> L'existant en `export function X({ ... })` (`context-menu.tsx`, `settings-bar.tsx`, `dev-panel.tsx`, `search/popover.tsx`…) est **migré vers `FC` quand on touche le fichier**. On n'écrit plus de nouveau composant en `function`.
>
> Exception : composant **générique** (`Select<T extends string>` dans `ui/select.tsx`) — `FC` ne supporte pas les génériques, on garde `export function`.

---

## Destructuration des props

Toujours en paramètre, jamais via `props.x`. Valeurs par défaut dans la destructuration (`side = "top"`).

```tsx
// ✅
export const Tooltip: FC<TooltipProps> = ({ children, content, side = "top" }) => { ... };

// ❌
export const Tooltip: FC<TooltipProps> = (props) => <div>{props.content}</div>;
```

---

## Un composant par fichier

Chaque fichier exporte **un seul composant**. Un sous-composant nécessaire est extrait dans son propre fichier, dans le dossier du widget (`ui/html-tree/tree-node.tsx`, `ui/search/results.tsx`).

Exceptions :

- **`ui/icons.tsx`** regroupe les icônes SVG (petits composants sans état).
- Un fichier de composant peut exporter des **helpers non-composants** liés (styles, fonctions pures : `rowStyle` dans `settings-menu/rows.tsx`, `statusColor` dans `dev-panel/net-detail.tsx`).

---

## Styles : inline + tokens

La lib n'a **ni CSS, ni Tailwind, ni CSS-in-JS** : tout est en `style={{ ... }}` (le rendu doit marcher tel quel dans n'importe quelle app hôte et dans le shadow DOM de l'extension).

- Couleurs, ombres, bordures : tokens de `src/core/inspector/constants/theme.ts` (`SOLID_BG`, `HOVER_BG`, `MUTED`, `PRIMARY`, `BTN_SHADOW`, `PANEL_BORDER`…).
- z-index : `UI_Z` (surfaces React) / `OVERLAY_Z` (inspecteur) de `constants/picker.ts`. Jamais de z-index en dur.
- Styles partagés d'un widget : fichier `styles.ts` local (`ui/dev-panel/styles.ts`).
- Thème sombre unique, repris de renderflow.

---

## Contraintes d'intégration

- **Ne jamais être pické** : la racine de tout élément rendu (y compris dans un portal) porte `data-pathpicker-ignore` (`IGNORE_ATTR`, `core/inspector/constants/behavior.ts`).
- **Portals** vers `document.body` pour ce qui flotte (tooltip, menus) ; penser au shadow DOM du content script de l'extension (utiliser `composedPath()` pour les clics extérieurs, cf. `use-outside-close.ts`).
- Pas de texte i18n : l'UI est en français, chaînes en dur acceptées.
- `react` / `react-dom` sont des peer deps : compatibles React ≥ 18, pas d'API React 19-only sans fallback.

---

## Récapitulatif

| Cas                        | Pattern                                  |
| -------------------------- | ---------------------------------------- |
| Composant avec props       | `export const X: FC<XProps> = ({...}) =>` |
| Composant sans props       | `export const X: FC = () =>`             |
| Composant générique        | `export function X<T>({...}: XProps<T>)` |
| Icônes                     | regroupées dans `ui/icons.tsx`           |
