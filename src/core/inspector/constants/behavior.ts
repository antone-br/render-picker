/** Constantes de comportement de l'inspecteur (hit-test, press, lifecycle). */

/** Attribut marquant une surface non-pickable (overlay, tooltip, HUD, bouton). */
export const IGNORE_ATTR = "data-pathpicker-ignore";

/** Profondeur max de descente du hit-test dans les enfants `pointer-events:none`. */
export const MAX_DESCEND = 32;

/** Durée d'avalage des events résiduels après un pick (ms). */
export const SWALLOW_MS = 700;

/** Events souris/pointeur avalés en capture pendant l'inspection. */
export const PRESS_EVENTS = [
  "pointerdown",
  "mousedown",
  "pointerup",
  "mouseup",
  "click",
  "auxclick",
  "dblclick",
  "contextmenu",
] as const;

const hasPointer = typeof window !== "undefined" && "PointerEvent" in window;

/** Type d'event « down » de référence (pointer si dispo, sinon souris). */
export const DOWN_TYPE = hasPointer ? "pointerdown" : "mousedown";
