import {
  BTN_SHADOW,
  ELEVATED_BG,
  MUTED,
  SECONDARY_BORDER,
} from "../../core/inspector/constants/theme";
import type { LogEntry } from "../../core/devpanel/store";

/** Couleur par niveau de log (onglet Console). */
export const LEVEL_COLOR: Record<LogEntry["level"], string> = {
  log: "#d4d4d8",
  info: "#60a5fa",
  debug: "#a1a1aa",
  warn: "#fde68a",
  error: "#f87171",
};

export const ACCENT_CORNER = "rgba(59,130,246,0.35)";
/** Gouttière réservée aux poignées de resize (hors des scrollbars du corps). */
export const GUTTER = 12;
/** Fond discret permanent des poignées (visibles au repos). */
export const HANDLE_BG = "rgba(255,255,255,0.05)";

/**
 * Boutons d'en-tête (Copier / Vider / Fermer) : variante « floating » (reprise du
 * Button renderflow). Hauteur fixe 22 → la croix carrée (`width: 22`) a la même taille.
 */
export const plainBtn = {
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 10px",
  fontSize: 10,
  fontWeight: 500,
  borderRadius: 6,
  cursor: "pointer",
  color: MUTED,
  background: ELEVATED_BG,
  border: SECONDARY_BORDER,
  boxShadow: BTN_SHADOW,
  backdropFilter: "blur(4px)",
  fontFamily: "system-ui, sans-serif",
  transition: "background-color 150ms, color 150ms, box-shadow 150ms",
} as const;
