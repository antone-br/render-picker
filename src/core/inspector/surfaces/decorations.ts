import type { LayoutOverlays } from "../../types";
import { GAP_DASH, GAP_STRIPES, MARGIN_FILL, PADDING_FILL } from "../constants/layout";
import { OVERLAY_RADIUS } from "../constants/picker";
import { assign } from "./dom";

export function clearDecorations(layer: HTMLElement): void {
  layer.textContent = "";
}

function fillRect(
  layer: HTMLElement,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  if (w <= 0 || h <= 0) return;
  const box = document.createElement("div");
  assign(box, {
    position: "fixed",
    top: `${y}px`,
    left: `${x}px`,
    width: `${w}px`,
    height: `${h}px`,
    background: color,
    pointerEvents: "none",
  });
  layer.appendChild(box);
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Contour pointillé — SVG `stroke-dasharray="3 3"` (identique à Chrome DevTools
 * `setLineDash([3,3])`), au-dessus du padding (z-index). Fond transparent.
 */
function dashedRect(
  layer: HTMLElement,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  radius: number,
): void {
  if (w <= 0 || h <= 0) return;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("data-rp-dash", "");
  svg.setAttribute("width", `${w}`);
  svg.setAttribute("height", `${h}`);
  assign(svg as unknown as HTMLElement, {
    position: "fixed",
    top: `${y}px`,
    left: `${x}px`,
    overflow: "visible",
    zIndex: "1",
    pointerEvents: "none",
  });
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", "0.5");
  rect.setAttribute("y", "0.5");
  rect.setAttribute("width", `${Math.max(0, w - 1)}`);
  rect.setAttribute("height", `${Math.max(0, h - 1)}`);
  rect.setAttribute("rx", `${radius}`);
  rect.setAttribute("fill", "none");
  rect.setAttribute("stroke", color);
  rect.setAttribute("stroke-width", "1");
  rect.setAttribute("stroke-dasharray", "3 3");
  svg.appendChild(rect);
  layer.appendChild(svg);
}

/**
 * Dessine les visualisations layout au survol : padding (vert, bandes entre la
 * bordure et la content-box) et gap (violet, espaces vides entre enfants
 * flex/grid). Approximatif — suffisant pour un repère visuel dev.
 */
export function renderDecorations(
  layer: HTMLElement,
  el: Element,
  rect: DOMRect,
  { padding, gap, margin }: LayoutOverlays,
): void {
  clearDecorations(layer);
  const cs = getComputedStyle(el);

  if (margin) {
    const mt = parseFloat(cs.marginTop) || 0;
    const mr = parseFloat(cs.marginRight) || 0;
    const mb = parseFloat(cs.marginBottom) || 0;
    const ml = parseFloat(cs.marginLeft) || 0;
    fillRect(layer, rect.left - ml, rect.top - mt, rect.width + ml + mr, mt, MARGIN_FILL);
    fillRect(layer, rect.left - ml, rect.bottom, rect.width + ml + mr, mb, MARGIN_FILL);
    fillRect(layer, rect.left - ml, rect.top, ml, rect.height, MARGIN_FILL);
    fillRect(layer, rect.right, rect.top, mr, rect.height, MARGIN_FILL);
  }

  if (padding) {
    const bt = parseFloat(cs.borderTopWidth) || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;
    const bb = parseFloat(cs.borderBottomWidth) || 0;
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const pl = parseFloat(cs.paddingLeft) || 0;
    // Un seul div : la bordure = le padding, border-radius = celui de l'overlay bleu,
    // pour épouser les coins arrondis sans déborder.
    const ring = document.createElement("div");
    assign(ring, {
      position: "fixed",
      top: `${rect.top + bt}px`,
      left: `${rect.left + bl}px`,
      width: `${rect.width - bl - br}px`,
      height: `${rect.height - bt - bb}px`,
      borderStyle: "solid",
      borderColor: PADDING_FILL,
      borderWidth: `${pt}px ${pr}px ${pb}px ${pl}px`,
      borderRadius: OVERLAY_RADIUS,
      boxSizing: "border-box",
      background: "transparent",
      pointerEvents: "none",
    });
    layer.appendChild(ring);
  }

  if (gap && /flex|grid/.test(cs.display)) {
    // Items flex/grid = éléments ET nœuds texte (anonymes), comme Chrome.
    const kids: DOMRect[] = [];
    for (const node of Array.from(el.childNodes)) {
      let r: DOMRect | null = null;
      if (node.nodeType === 1) {
        r = (node as Element).getBoundingClientRect();
      } else if (node.nodeType === 3 && node.textContent && node.textContent.trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        r = range.getBoundingClientRect();
      }
      if (r && r.width > 0 && r.height > 0) kids.push(r);
    }

    // Content-box du conteneur : le gap couvre toute la piste (axe transverse),
    // comme Chrome — pas seulement le chevauchement des deux enfants.
    const bt = parseFloat(cs.borderTopWidth) || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;
    const bb = parseFloat(cs.borderBottomWidth) || 0;
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const ct = rect.top + bt + (parseFloat(cs.paddingTop) || 0);
    const cb = rect.bottom - bb - (parseFloat(cs.paddingBottom) || 0);
    const cl = rect.left + bl + (parseFloat(cs.paddingLeft) || 0);
    const cr = rect.right - br - (parseFloat(cs.paddingRight) || 0);

    // Seul un vrai `gap` CSS compte (pas l'espacement par marges des enfants).
    const rowGap = parseFloat(cs.rowGap) || 0;
    const colGap = parseFloat(cs.columnGap) || 0;

    let drew = false;

    // Paires CONSÉCUTIVES uniquement (triées par axe) : une bande ne peut pas
    // enjamber un 3e enfant intermédiaire (sinon le gap « traverse » son contenu).
    if (colGap > 0) {
      const byX = [...kids].sort((a, b) => a.left - b.left);
      for (let i = 0; i < byX.length - 1; i++) {
        const a = byX[i]!;
        const b = byX[i + 1]!;
        if (b.left >= a.right && a.bottom > b.top && b.bottom > a.top) {
          fillRect(layer, a.right, ct, b.left - a.right, cb - ct, GAP_STRIPES);
          drew = true;
        }
      }
    }

    if (rowGap > 0) {
      const byY = [...kids].sort((a, b) => a.top - b.top);
      for (let i = 0; i < byY.length - 1; i++) {
        const a = byY[i]!;
        const b = byY[i + 1]!;
        if (b.top >= a.bottom && a.right > b.left && b.right > a.left) {
          fillRect(layer, cl, a.bottom, cr - cl, b.top - a.bottom, GAP_STRIPES);
          drew = true;
        }
      }
    }

    // Contour pointillé à l'intérieur du padding (bord de la content-box),
    // au-dessus du padding vert (z-index). Coins droits si la content-box est
    // en retrait (padding/bordure) — le radius n'appartient qu'à la border-box.
    const inset =
      cl !== rect.left || ct !== rect.top || cr !== rect.right || cb !== rect.bottom;
    const dashRadius = inset ? 0 : parseFloat(OVERLAY_RADIUS);
    if (drew) dashedRect(layer, cl, ct, cr - cl, cb - ct, GAP_DASH, dashRadius);
  }
}
