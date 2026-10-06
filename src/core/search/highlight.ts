import { IGNORE_ATTR } from "../inspector/constants/behavior";
import {
  HIGHLIGHT_BG,
  HIGHLIGHT_BORDER,
  OVERLAY_RADIUS,
  OVERLAY_Z,
  SELECTED_BG,
} from "../inspector/constants/picker";
import {
  BTN_SHADOW,
  SECONDARY_BG_HOVER,
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
} from "../inspector/constants/theme";
import { assign } from "../inspector/surfaces/dom";
import { dimsText, updateTooltip } from "../inspector/surfaces/tooltip";
import { vscodeActionFor } from "../dev/click-to-source";
import { SEARCH_UI_ATTR } from "./element-search";

/**
 * Highlights « survol » pour les résultats de recherche : tout match porte un
 * rect au style de l'overlay de survol de l'inspecteur, l'élément actif
 * (↑/↓ ou survol de la ligne) en reçoit un plus net par-dessus. Repositionne en
 * continu (rAF) pour suivre le scroll/resize de la page — sans React.
 * Survole un rect (rects interactifs) → tooltip info du composant + métriques.
 */

export interface SearchHighlight {
  /** (Re)dessine les rects pour la liste d'éléments (cap ~50 côté recherche). */
  update(elements: HTMLElement[]): void;
  /** Rects nets (indices dans la dernière liste — sélection de groupe multi). */
  setActive(indices: number[]): void;
  /** Filtre souris (survol d'une ligne de suggestion) : `null` = tous, sinon SEULES ces occurrences visibles. */
  setFilter(indices: number[] | null): void;
  /** Retire tous les rects (input vidé). */
  clear(): void;
  /** Retire la couche du DOM et arrête la boucle rAF. */
  destroy(): void;
}

function createTooltipSurface(): {
  tooltip: HTMLElement;
  label: HTMLElement;
  divider: HTMLElement;
  metrics: HTMLElement;
  dims: HTMLElement;
} {
  const tooltip = document.createElement("div");
  assign(tooltip, {
    position: "fixed",
    display: "none",
    zIndex: "3",
    maxWidth: "420px",
    padding: "6px 6px 6px 10px",
    borderRadius: "6px",
    font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
    color: "#fff",
    background: SECONDARY_SURFACE,
    border: SECONDARY_BORDER,
    boxShadow: BTN_SHADOW,
    pointerEvents: "none",
    alignItems: "flex-start",
    gap: "10px",
  });

  const col = document.createElement("div");
  assign(col, { display: "flex", flexDirection: "column", minWidth: "0" });

  const label = document.createElement("span");
  assign(label, { whiteSpace: "pre-line" });
  col.appendChild(label);

  const divider = document.createElement("div");
  assign(divider, {
    display: "none",
    height: "1px",
    margin: "5px 0",
    alignSelf: "stretch",
    background: "rgba(255,255,255,0.14)",
  });
  col.appendChild(divider);

  const metrics = document.createElement("span");
  assign(metrics, { display: "none", whiteSpace: "pre-line", color: "#d4d4d8" });
  col.appendChild(metrics);

  tooltip.appendChild(col);

  const dims = document.createElement("span");
  assign(dims, {
    marginLeft: "auto",
    flexShrink: "0",
    padding: "1px 5px",
    borderRadius: "4px",
    font: "600 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
    color: "#60a5fa",
    background: "rgba(59,130,246,0.15)",
    border: "1px solid rgba(59,130,246,0.3)",
    whiteSpace: "nowrap",
  });
  tooltip.appendChild(dims);

  return { tooltip, label, divider, metrics, dims };
}

export interface SearchHighlightOptions {
  /** Clic sur un rect : copie le snippet enrichi côté appelant (scroll inclus). */
  onPick?: (el: HTMLElement) => void;
  /** Clic droit sur un rect : ouvre le menu contextuel (copier HTML / classes). */
  onContextMenu?: (el: HTMLElement, pos: { x: number; y: number }) => void;
  /**
   * Ctrl+click / Alt+click sur un rect → même geste que picker éteint (VS Code).
   * Retourne `true` quand l'ouverture a été prise en charge.
   */
  onVscode?: (el: HTMLElement, action: "source" | "usage") => boolean;
}

export function createSearchHighlight(options: SearchHighlightOptions = {}): SearchHighlight {
  const root = document.createElement("div");
  root.setAttribute(IGNORE_ATTR, "");
  root.setAttribute(SEARCH_UI_ATTR, "");
  assign(root, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: String(OVERLAY_Z),
  });
  document.documentElement.appendChild(root);

  const surface = createTooltipSurface();
  root.appendChild(surface.tooltip);

  let rects: HTMLElement[] = [];
  let elements: HTMLElement[] = [];
  let activeSet = new Set<number>();
  let filterSet: Set<number> | null = null;
  let hoveredIndex = -1;
  let disposed = false;
  let rafId = 0;

  function makeRect(): HTMLElement {
    const rect = document.createElement("div");
    rect.setAttribute(SEARCH_UI_ATTR, "");
    assign(rect, {
      position: "fixed",
      background: HIGHLIGHT_BG,
      border: HIGHLIGHT_BORDER,
      borderRadius: OVERLAY_RADIUS,
      boxSizing: "border-box",
      pointerEvents: "auto",
      cursor: "crosshair",
      display: "none",
    });
    root.appendChild(rect);
    return rect;
  }

  function place(rect: HTMLElement, el: HTMLElement): void {
    const r = el.getBoundingClientRect();
    rect.style.display = "block";
    rect.style.top = `${r.top}px`;
    rect.style.left = `${r.left}px`;
    rect.style.width = `${r.width}px`;
    rect.style.height = `${r.height}px`;
  }

  function redraw(): void {
    if (disposed) return;
    elements.forEach((el, i) => {
      const rect = rects[i];
      if (filterSet && !filterSet.has(i)) {
        if (rect) rect.style.display = "none";
        return;
      }
      if (!rect || !el.isConnected) {
        if (rect) rect.style.display = "none";
        return;
      }
      const active = activeSet.has(i) || i === hoveredIndex;
      rect.style.background = active ? SELECTED_BG : HIGHLIGHT_BG;
      rect.style.border = active
        ? HIGHLIGHT_BORDER
        : "1px solid rgba(59,130,246,0.35)";
      place(rect, el);
    });

    if (hoveredIndex >= 0 && rects[hoveredIndex] && elements[hoveredIndex]?.isConnected) {
      const el = elements[hoveredIndex]!;
      updateTooltip(
        surface.tooltip,
        surface.label,
        surface.divider,
        surface.metrics,
        surface.dims,
        el,
        [],
        el.getBoundingClientRect(),
      );
    }
  }

  // Suivi scroll/resize en continu (les scrolls de sous-conteneurs ne
  // déclenchent pas `scroll` sur window).
  const loop = (): void => {
    if (disposed) return;
    redraw();
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  return {
    update(next) {
      elements = next;
      filterSet = null;
      // Réutilise les rects existants (pool), crée le manque, cache le surplus.
      while (rects.length < elements.length) rects.push(makeRect());
      for (const rect of rects.slice(elements.length)) rect.style.display = "none";
      rects.length = elements.length;
      rects.forEach((rect, i) => {
        rect.onmouseenter = () => {
          if (rect.style.display === "none") return;
          hoveredIndex = i;
          redraw();
        };
        rect.onmouseleave = () => {
          hoveredIndex = -1;
          surface.tooltip.style.display = "none";
        };
        rect.onmousedown = (e) => {
          e.preventDefault();
          e.stopPropagation();
        };
        rect.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const el = elements[i];
          if (!el) return;
          options.onContextMenu?.(el, { x: e.clientX, y: e.clientY });
        };
        rect.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const el = elements[i];
          if (!el) return;
          const action = vscodeActionFor(e);
          if (action && options.onVscode?.(el, action)) return;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          options.onPick?.(el);
        };
      });
      redraw();
    },
    setActive(indices) {
      activeSet = new Set(indices);
      redraw();
    },
    setFilter(indices) {
      filterSet = indices ? new Set(indices) : null;
      redraw();
    },
    clear() {
      elements = [];
      hoveredIndex = -1;
      activeSet = new Set();
      filterSet = null;
      surface.tooltip.style.display = "none";
      for (const rect of rects) rect.style.display = "none";
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(rafId);
      root.remove();
      rects = [];
      elements = [];
    },
  };
}
