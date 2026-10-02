import { OVERLAY_GLIDE } from "../constants/picker";
import { assign } from "./dom";

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
