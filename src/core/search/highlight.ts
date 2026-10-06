import { IGNORE_ATTR } from "../inspector/constants/behavior";
import {
  HIGHLIGHT_BG,
  HIGHLIGHT_BORDER,
  OVERLAY_RADIUS,
  OVERLAY_Z,
  SELECTED_BG,
} from "../inspector/constants/picker";
import { assign } from "../inspector/surfaces/dom";

/**
 * Highlights « survol » pour les résultats de recherche : tout match porte un
 * rect au style de l'overlay de survol de l'inspecteur, l'élément actif
 * (↑/↓ ou survol de la ligne) en reçoit un plus net par-dessus. Repositionne en
 * continu (rAF) pour suivre le scroll/resize de la page — sans React.
 */

export interface SearchHighlight {
  /** (Re)dessine les rects pour la liste d'éléments (cap ~50 côté recherche). */
  update(elements: HTMLElement[]): void;
  /** Déplace le rect actif (index dans la dernière liste passée à `update`). */
  setActive(index: number): void;
  /** Retire tous les rects (input vidé). */
  clear(): void;
  /** Retire la couche du DOM et arrête la boucle rAF. */
  destroy(): void;
}

export function createSearchHighlight(): SearchHighlight {
  const root = document.createElement("div");
  root.setAttribute(IGNORE_ATTR, "");
  assign(root, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: String(OVERLAY_Z),
  });
  document.documentElement.appendChild(root);

  let rects: HTMLElement[] = [];
  let elements: HTMLElement[] = [];
  let activeIndex = -1;
  let disposed = false;
  let rafId = 0;

  function makeRect(bg: string, border: string): HTMLElement {
    const rect = document.createElement("div");
    assign(rect, {
      position: "fixed",
      background: bg,
      border,
      borderRadius: OVERLAY_RADIUS,
      boxSizing: "border-box",
      pointerEvents: "none",
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
      if (!rect || !el.isConnected) {
        if (rect) rect.style.display = "none";
        return;
      }
      const active = i === activeIndex;
      rect.style.background = active ? SELECTED_BG : HIGHLIGHT_BG;
      rect.style.border = active
        ? HIGHLIGHT_BORDER
        : "1px solid rgba(59,130,246,0.35)";
      place(rect, el);
    });
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
      // Réutilise les rects existants (.WebElement pooled), crée le manque, cache le surplus.
      while (rects.length < elements.length)
        rects.push(makeRect(HIGHLIGHT_BG, HIGHLIGHT_BORDER));
      for (const rect of rects.slice(elements.length)) rect.style.display = "none";
      rects.length = elements.length;
      this.setActive(activeIndex);
      redraw();
    },
    setActive(index) {
      activeIndex = index;
      redraw();
    },
    clear() {
      elements = [];
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
