/** Constantes de comportement de l'inspecteur (hit-test, press, lifecycle). */

/** Attribut marquant une surface non-pickable (overlay, tooltip, HUD, bouton). */
export const IGNORE_ATTR = "data-pathpicker-ignore";

/**
 * Attribut posé sur `<html>` par le package npm (init / bouton monté). L'extension
 * Chrome le lit pour se désactiver si l'app utilise déjà le package (pas de double picker).
 */
export const NPM_MARKER_ATTR = "data-render-picker";

/** Profondeur max de descente du hit-test dans les enfants `pointer-events:none`. */
export const MAX_DESCEND = 32;

/** Durée d'avalage des events résiduels après un pick (ms). */
export const SWALLOW_MS = 700;

/** Fenêtre d'un double-tap (ms) : armement + commandes clavier double-tap. */
export const DOUBLE_TAP_WINDOW = 400;

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

/** Menu contextuel ouvert : le clic qui le ferme ne doit pas pick (fermeture seule). */
export const CONTEXT_MENU_OPEN = { value: false };

const hasPointer = typeof window !== "undefined" && "PointerEvent" in window;

/** Type d'event « down » de référence (pointer si dispo, sinon souris). */
export const DOWN_TYPE = hasPointer ? "pointerdown" : "mousedown";
