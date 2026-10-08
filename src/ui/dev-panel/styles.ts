import {
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
  TOOLTIP_SHADOW,
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

/** Boutons Copier / Vider : bouton simple. */
export const plainBtn = {
  padding: "3px 8px",
  fontSize: 10,
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  color: "#fff",
  background: "rgba(255,255,255,0.08)",
  fontFamily: "system-ui, sans-serif",
} as const;

/** Boutons d'en-tête : même UI/hauteur que la croix (style tooltip). */
export const headerBtn = {
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 8px",
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 6,
  cursor: "pointer",
  color: "#fff",
  background: SECONDARY_SURFACE,
  border: SECONDARY_BORDER,
  boxShadow: TOOLTIP_SHADOW,
  fontFamily: "system-ui, sans-serif",
} as const;
