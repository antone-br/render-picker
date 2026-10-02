import type { LayoutOverlays } from "../types";
import { componentInfo } from "../source/component-annotate";
import { IGNORE_ATTR } from "./constants";
import {
  BTN_SHADOW,
  GAP_DASH,
  GAP_STRIPES,
  HIGHLIGHT_BORDER,
  MARGIN_FILL,
  OVERLAY_GLIDE,
  OVERLAY_RADIUS,
  OVERLAY_Z,
  PADDING_FILL,
  PANEL_BORDER,
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
  SELECTED_BG,
  SOLID_BG,
  TOOLTIP_SHADOW,
} from "./pick-style";

/**
 * Surfaces flottantes de l'inspecteur : overlay de survol, tooltip, markers de
 * sélection et décorations layout (padding/gap). Construction + stylage +
 * positionnement, découplés de la logique de l'inspecteur.
 */

const TOOLTIP_MAX_W = 420;

export interface Surfaces {
  container: HTMLElement;
  overlay: HTMLElement;
  tooltip: HTMLElement;
  tooltipLabel: HTMLElement;
  tooltipDivider: HTMLElement;
  tooltipMetrics: HTMLElement;
  dims: HTMLElement;
  decorLayer: HTMLElement;
  markerLayer: HTMLElement;
}

function assign(el: HTMLElement, style: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, style);
}

function isDisabled(el: Element): boolean {
  try {
    return el.matches(':disabled,[disabled],[aria-disabled="true"]');
  } catch {
    return false;
  }
}

/** Construit le conteneur et ses surfaces (non attaché au DOM). */
export function createSurfaces(): Surfaces {
  const container = document.createElement("div");
  container.setAttribute(IGNORE_ATTR, "");
  assign(container, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: String(OVERLAY_Z),
  });

  // Décorations layout (padding/gap) sous l'overlay ; markers par-dessus.
  const decorLayer = document.createElement("div");
  container.appendChild(decorLayer);

  const markerLayer = document.createElement("div");
  container.appendChild(markerLayer);

  const overlay = document.createElement("div");
  assign(overlay, {
    position: "fixed",
    display: "block",
    opacity: "0",
    background: "transparent",
    border: HIGHLIGHT_BORDER,
    borderRadius: OVERLAY_RADIUS,
    boxSizing: "border-box",
    pointerEvents: "none",
    transition: OVERLAY_GLIDE,
  });
  container.appendChild(overlay);

  const tooltip = document.createElement("div");
  assign(tooltip, {
    position: "fixed",
    display: "none",
    zIndex: "2",
    maxWidth: `${TOOLTIP_MAX_W}px`,
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

  const tooltipCol = document.createElement("div");
  assign(tooltipCol, { display: "flex", flexDirection: "column", minWidth: "0" });

  const tooltipLabel = document.createElement("span");
  assign(tooltipLabel, { whiteSpace: "pre-line" });
  tooltipCol.appendChild(tooltipLabel);

  const tooltipDivider = document.createElement("div");
  assign(tooltipDivider, {
    display: "none",
    height: "1px",
    margin: "5px 0",
    alignSelf: "stretch",
    background: "rgba(255,255,255,0.14)",
  });
  tooltipCol.appendChild(tooltipDivider);

  const tooltipMetrics = document.createElement("span");
  assign(tooltipMetrics, {
    display: "none",
    whiteSpace: "pre-line",
    color: "#d4d4d8",
  });
  tooltipCol.appendChild(tooltipMetrics);

  tooltip.appendChild(tooltipCol);

  // Badge dimensions, intégré dans la bulle (coin haut-droite), poussé à droite.
  const dims = document.createElement("span");
  assign(dims, {
    marginLeft: "auto",
    flexShrink: "0",
    padding: "1px 5px",
    borderRadius: "4px",
    font: "600 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
    background: "rgba(255,255,255,0.12)",
    whiteSpace: "nowrap",
  });
  tooltip.appendChild(dims);
  container.appendChild(tooltip);

  return {
    container,
    overlay,
    tooltip,
    tooltipLabel,
    tooltipDivider,
    tooltipMetrics,
    dims,
    decorLayer,
    markerLayer,
  };
}

/**
 * Positionne l'overlay. `animate` (défaut) laisse la transition « glisse »
 * jouer entre deux éléments survolés ; `animate = false` repositionne
 * instantanément (scroll/resize) puis réactive le glisse pour le prochain survol.
 */
export function positionOverlay(
  overlay: HTMLElement,
  rect: DOMRect,
  animate = true,
): void {
  if (!animate) overlay.style.transition = "none";
  assign(overlay, {
    opacity: "1",
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  if (!animate) {
    void overlay.offsetWidth; // force le reflow → applique la position sans anim
    overlay.style.transition = OVERLAY_GLIDE;
  }
}

export function hideHover(overlay: HTMLElement, tooltip: HTMLElement): void {
  overlay.style.opacity = "0";
  tooltip.style.display = "none";
}

/** Dimensions de l'élément, arrondies : `120×20`. */
export function dimsText(rect: DOMRect): string {
  return `${Math.round(rect.width)}×${Math.round(rect.height)}`;
}

/** Raccourci d'une box (padding/margin) : `null` si tout nul, sinon shorthand px. */
function boxValue(t: number, r: number, b: number, l: number): string | null {
  if (!t && !r && !b && !l) return null;
  if (t === r && r === b && b === l) return `${t}px`;
  if (t === b && l === r) return `${t}px ${r}px`;
  return `${t}px ${r}px ${b}px ${l}px`;
}

const px = (v: string): number => parseFloat(v) || 0;

/** Titre du tooltip : nom du composant (+ `· disabled`, `· selected #n`). `""` si rien. */
export function tooltipTitle(el: Element, selection: Element[]): string {
  const parts: string[] = [];
  const comp = componentInfo(el as HTMLElement)?.component;
  if (comp) parts.push(comp);
  if (isDisabled(el)) parts.push("disabled");
  const selIdx = selection.indexOf(el);
  if (selIdx >= 0) parts.push(`selected #${selIdx + 1}`);
  return parts.join(" · ");
}

/** Métriques layout en px : `padding: …` / `gap: …` / `margin: …` (que si non nuls). */
export function tooltipMetrics(el: Element): string {
  const cs = getComputedStyle(el);
  const lines: string[] = [];

  const padding = boxValue(
    px(cs.paddingTop),
    px(cs.paddingRight),
    px(cs.paddingBottom),
    px(cs.paddingLeft),
  );
  if (padding) lines.push(`padding: ${padding}`);

  const rowGap = px(cs.rowGap);
  const colGap = px(cs.columnGap);
  if (/flex|grid/.test(cs.display) && (rowGap || colGap)) {
    lines.push(`gap: ${rowGap === colGap ? `${rowGap}px` : `${rowGap}px ${colGap}px`}`);
  }

  const margin = boxValue(
    px(cs.marginTop),
    px(cs.marginRight),
    px(cs.marginBottom),
    px(cs.marginLeft),
  );
  if (margin) lines.push(`margin: ${margin}`);

  return lines.join("\n");
}

export function updateTooltip(
  tooltip: HTMLElement,
  label: HTMLElement,
  divider: HTMLElement,
  metrics: HTMLElement,
  dims: HTMLElement,
  el: Element,
  selection: Element[],
  rect: DOMRect,
): void {
  const title = tooltipTitle(el, selection);
  const metricsText = tooltipMetrics(el);
  label.textContent = title;
  label.style.display = title ? "block" : "none";
  metrics.textContent = metricsText;
  metrics.style.display = metricsText ? "block" : "none";
  // Barre horizontale entre composant et métriques (si les deux présents).
  divider.style.display = title && metricsText ? "block" : "none";
  dims.textContent = dimsText(rect);
  tooltip.style.display = "flex";

  const tipH = tooltip.offsetHeight;
  let top = rect.bottom + 8;
  if (top + tipH > window.innerHeight) top = rect.top - tipH - 8;
  let left = rect.left;
  if (left + TOOLTIP_MAX_W > window.innerWidth) {
    left = window.innerWidth - TOOLTIP_MAX_W - 10;
  }
  if (left < 4) left = 4;
  assign(tooltip, { top: `${top}px`, left: `${left}px` });
}

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

/** Contour pointillé (fond transparent) — autour du conteneur à gaps. */
function dashedRect(
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
    border: `1px dashed ${color}`,
    borderRadius: OVERLAY_RADIUS,
    boxSizing: "border-box",
    zIndex: "1",
    pointerEvents: "none",
  });
  layer.appendChild(box);
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
    const kids = Array.from(el.children)
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);

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

    let drew = false;

    // Paires CONSÉCUTIVES uniquement (triées par axe) : une bande ne peut pas
    // enjamber un 3e enfant intermédiaire (sinon le gap « traverse » son contenu).
    const byX = [...kids].sort((a, b) => a.left - b.left);
    for (let i = 0; i < byX.length - 1; i++) {
      const a = byX[i]!;
      const b = byX[i + 1]!;
      if (b.left >= a.right && a.bottom > b.top && b.bottom > a.top) {
        fillRect(layer, a.right, ct, b.left - a.right, cb - ct, GAP_STRIPES);
        drew = true;
      }
    }

    const byY = [...kids].sort((a, b) => a.top - b.top);
    for (let i = 0; i < byY.length - 1; i++) {
      const a = byY[i]!;
      const b = byY[i + 1]!;
      if (b.top >= a.bottom && a.right > b.left && b.right > a.left) {
        fillRect(layer, cl, a.bottom, cr - cl, b.top - a.bottom, GAP_STRIPES);
        drew = true;
      }
    }

    // Contour pointillé à l'intérieur du padding (bord de la content-box),
    // au-dessus du padding vert (z-index). Comme l'inspecteur Chrome.
    if (drew) dashedRect(layer, cl, ct, cr - cl, cb - ct, GAP_DASH);
  }
}

export function renderMarkers(layer: HTMLElement, selection: Element[]): void {
  layer.textContent = "";
  selection.forEach((el, i) => {
    if (!el.isConnected) return;
    const rect = el.getBoundingClientRect();
    const marker = document.createElement("div");
    assign(marker, {
      position: "fixed",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      background: SELECTED_BG,
      border: HIGHLIGHT_BORDER,
      borderRadius: "4px",
      boxSizing: "border-box",
      pointerEvents: "none",
    });
    const badge = document.createElement("span");
    badge.textContent = String(i + 1);
    assign(badge, {
      position: "absolute",
      top: "-7px",
      left: "-7px",
      minWidth: "14px",
      height: "14px",
      padding: "0 3px",
      borderRadius: "7px",
      background: HIGHLIGHT_BORDER.split(" ").pop() ?? "#3b82f6",
      color: "#fff",
      font: "600 9px/14px ui-monospace, monospace",
      textAlign: "center",
      boxSizing: "border-box",
    });
    marker.appendChild(badge);

    // Tooltip dimensions en haut-droite de l'élément sélectionné.
    const dimsBadge = document.createElement("span");
    dimsBadge.textContent = dimsText(rect);
    assign(dimsBadge, {
      position: "absolute",
      top: "-20px",
      right: "0",
      padding: "1px 5px",
      borderRadius: "4px",
      font: "600 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
      color: "#fff",
      background: SOLID_BG,
      border: PANEL_BORDER,
      boxShadow: TOOLTIP_SHADOW,
      whiteSpace: "nowrap",
      boxSizing: "border-box",
    });
    marker.appendChild(dimsBadge);
    layer.appendChild(marker);
  });
}
