import { HIGHLIGHT_BORDER, SELECTED_BG } from "../constants/picker";
import { PANEL_BORDER, SOLID_BG, TOOLTIP_SHADOW } from "../constants/theme";
import { assign } from "./dom";
import { dimsText } from "./tooltip";

/** Dessine les rectangles numérotés de la sélection multiple (+ badge dimensions). */
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
