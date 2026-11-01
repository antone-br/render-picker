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

/** Clé `window` portant l'état armé — voir `PICKER_ARMED` ci-dessous. */
const ARMED_WINDOW_KEY = "__renderPickerArmed";

/**
 * Picker armé (entre `activate()` et `deactivate()`) — lu par `click-to-source.ts` pour
 * n'ouvrir l'éditeur via `commands.usage` (Ctrl+clic par défaut) que picker armé.
 *
 * Backé par `window`, PAS une simple variable de module : le package expose 4 entrées
 * indépendantes (`.`/`client`/`react`/`next`, voir `package.json#exports`), chacune
 * bundlée séparément (`tsup`, builds CJS surtout — pas de chunk partagé entre entrées
 * CJS). Une app qui importe À LA FOIS `@antone-br/render-picker/client`
 * (`initRenderPicker`, pose `initClickToSource`) ET `/react` (`RenderPickerButton`,
 * l'inspecteur qui arme/désarme) — cas réel : renderflow — se retrouve avec 2 COPIES de
 * ce module, chacune avec sa propre variable `{ value: false }` : `activate()` armerait
 * une copie, `click-to-source.ts` en lirait une autre, toujours à `false`. `window` est
 * le seul objet vraiment unique quel que soit le nombre de copies du module JS.
 */
export const PICKER_ARMED = {
  get value(): boolean {
    // `window` non typé pour cette clé interne — pas la peine d'une augmentation globale
    // pour un seul flag privé au package.
    return typeof window !== "undefined" && (window as unknown as Record<string, unknown>)[ARMED_WINDOW_KEY] === true;
  },
  set value(armed: boolean) {
    if (typeof window === "undefined") return;
    (window as unknown as Record<string, unknown>)[ARMED_WINDOW_KEY] = armed;
  },
};

const hasPointer = typeof window !== "undefined" && "PointerEvent" in window;

/** Type d'event « down » de référence (pointer si dispo, sinon souris). */
export const DOWN_TYPE = hasPointer ? "pointerdown" : "mousedown";
