import { componentInfo } from "../source/component-annotate";
import { IGNORE_ATTR } from "./constants";
import {
  HIGHLIGHT_BG,
  HIGHLIGHT_BORDER,
  OVERLAY_Z,
  PANEL_BORDER,
  SELECTED_BG,
  SOLID_BG,
  TOOLTIP_SHADOW,
} from "./pick-style";

/**
 * Surfaces flottantes de l'inspecteur : overlay de survol, tooltip, HUD bas, et
 * markers de sélection. Construction + stylage + positionnement, découplés de la
 * logique de l'inspecteur.
 */

const HASH_CLASS_RE = /^css-[a-z0-9]+$/i;
const TOOLTIP_MAX_W = 420;

export interface Surfaces {
  container: HTMLElement;
  overlay: HTMLElement;
  tooltip: HTMLElement;
  hud: HTMLElement;
  markerLayer: HTMLElement;
}

function assign(el: HTMLElement, style: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, style);
}

function retainedClasses(el: Element): string[] {
  return Array.from(el.classList).filter((c) => !HASH_CLASS_RE.test(c));
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

  const markerLayer = document.createElement("div");
  container.appendChild(markerLayer);

  const overlay = document.createElement("div");
  assign(overlay, {
    position: "fixed",
    display: "none",
    background: HIGHLIGHT_BG,
    border: HIGHLIGHT_BORDER,
    borderRadius: "4px",
    boxSizing: "border-box",
    pointerEvents: "none",
    transition: "opacity 0.08s ease-out",
  });
  container.appendChild(overlay);

  const tooltip = document.createElement("div");
  assign(tooltip, {
    position: "fixed",
    display: "none",
    zIndex: "2",
    maxWidth: `${TOOLTIP_MAX_W}px`,
    padding: "6px 10px",
    borderRadius: "6px",
    font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
    color: "#fff",
    background: SOLID_BG,
    border: PANEL_BORDER,
    boxShadow: TOOLTIP_SHADOW,
    whiteSpace: "pre-line",
    pointerEvents: "none",
  });
  container.appendChild(tooltip);

  const hud = document.createElement("div");
  assign(hud, {
    position: "fixed",
    bottom: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "3",
    padding: "6px 12px",
    borderRadius: "999px",
    font: "12px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
    color: "#fff",
    background: SOLID_BG,
    border: PANEL_BORDER,
    boxShadow: TOOLTIP_SHADOW,
    whiteSpace: "nowrap",
    pointerEvents: "none",
  });
  container.appendChild(hud);

  return { container, overlay, tooltip, hud, markerLayer };
}

export function positionOverlay(overlay: HTMLElement, rect: DOMRect): void {
  assign(overlay, {
    display: "block",
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
}

export function hideHover(overlay: HTMLElement, tooltip: HTMLElement): void {
  overlay.style.display = "none";
  tooltip.style.display = "none";
}

/** Texte du tooltip : composant (si présent) sur la 1re ligne, balise dessous. */
export function tooltipText(el: Element, selection: Element[]): string {
  const tag = el.tagName.toLowerCase();
  const classStr = retainedClasses(el)
    .slice(0, 3)
    .map((c) => `.${c}`)
    .join("");
  let head = `<${tag}${classStr}>`;
  if (isDisabled(el)) head += " · disabled";
  const selIdx = selection.indexOf(el);
  if (selIdx >= 0) head += ` · selected #${selIdx + 1}`;

  const comp = componentInfo(el as HTMLElement)?.component;
  return comp ? `${comp}\n${head}` : head;
}

export function updateTooltip(
  tooltip: HTMLElement,
  el: Element,
  selection: Element[],
  rect: DOMRect,
): void {
  tooltip.textContent = tooltipText(el, selection);
  tooltip.style.display = "block";

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

/** Libellé du HUD. Le rappel « Entrée pour valider » est géré côté React. */
export function hudText(): string {
  return "Esc to cancel";
}

export function renderHud(hud: HTMLElement): void {
  hud.textContent = hudText();
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
      top: "-9px",
      left: "-9px",
      minWidth: "18px",
      height: "18px",
      padding: "0 4px",
      borderRadius: "9px",
      background: HIGHLIGHT_BORDER.split(" ").pop() ?? "#3b82f6",
      color: "#fff",
      font: "600 11px/18px ui-monospace, monospace",
      textAlign: "center",
      boxSizing: "border-box",
    });
    marker.appendChild(badge);
    layer.appendChild(marker);
  });
}
