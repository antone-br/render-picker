import { IGNORE_ATTR } from "../constants/behavior";
import {
  HIGHLIGHT_BORDER,
  OVERLAY_GLIDE,
  OVERLAY_RADIUS,
  OVERLAY_Z,
} from "../constants/picker";
import { BTN_SHADOW, SECONDARY_BORDER, SECONDARY_SURFACE } from "../constants/theme";
import { assign } from "./dom";

const TOOLTIP_MAX_W = 420;

/** Surfaces flottantes de l'inspecteur (overlay, tooltip, décorations, markers). */
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

  // Badge dimensions (ex. 12×522), intégré dans la bulle (coin haut-droite), poussé
  // à droite. Variante « blue » (comme les dropdowns ≠ défaut).
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
