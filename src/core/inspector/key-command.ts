import { modifierMatches, type InspectBinding, type SearchBinding } from "../settings";
import { DOUBLE_TAP_WINDOW } from "./constants/behavior";

/**
 * Matcher d'une commande clavier (modificateur + touche, simple ou double-tap).
 * État interne : timestamp du 1er tap d'un double. Pur / testable (`e.timeStamp`).
 *
 * `status` renvoie `"fire"` (déclencher), `"wait"` (1er tap d'un double enregistré,
 * à avaler sans action) ou `null` (pas de correspondance).
 */
export interface KeyCommandMatcher {
  status(e: KeyboardEvent, b: SearchBinding | InspectBinding): "fire" | "wait" | null;
  reset(): void;
}

export function createKeyCommandMatcher(): KeyCommandMatcher {
  let tapAt: number | null = null;
  return {
    status(e, b) {
      if (b.key === "off") return null;
      if (!modifierMatches(b.modifier, e)) return null;
      if (e.key.toLowerCase() !== b.key) return null;
      if (!b.double) return "fire";
      // Auto-répétition (touche tenue) ne compte jamais comme 2e tap.
      if (e.repeat) return "wait";
      if (tapAt !== null && e.timeStamp - tapAt <= DOUBLE_TAP_WINDOW) {
        tapAt = null;
        return "fire";
      }
      tapAt = e.timeStamp;
      return "wait";
    },
    reset() {
      tapAt = null;
    },
  };
}
