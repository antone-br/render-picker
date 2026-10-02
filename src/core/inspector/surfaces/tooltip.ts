import { componentInfo } from "../../source/component-annotate";
import { assign } from "./dom";

const TOOLTIP_MAX_W = 420;

function isDisabled(el: Element): boolean {
  try {
    return el.matches(':disabled,[disabled],[aria-disabled="true"]');
  } catch {
    return false;
  }
}

const px = (v: string): number => parseFloat(v) || 0;

/** Raccourci d'une box (padding/margin) : `null` si tout nul, sinon shorthand px. */
function boxValue(t: number, r: number, b: number, l: number): string | null {
  if (!t && !r && !b && !l) return null;
  if (t === r && r === b && b === l) return `${t}px`;
  if (t === b && l === r) return `${t}px ${r}px`;
  return `${t}px ${r}px ${b}px ${l}px`;
}

/** Dimensions de l'élément, arrondies : `120×20`. */
export function dimsText(rect: DOMRect): string {
  return `${Math.round(rect.width)}×${Math.round(rect.height)}`;
}

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
