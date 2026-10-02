/**
 * Palette UI (thème sombre repris de renderflow) partagée par le tooltip / HUD
 * de l'inspecteur et l'UI React (barre, dropdown, modal, checkbox). Pures valeurs.
 */

/** Fond solide (sans opacité) partagé tooltip / bulle / toast. */
export const SOLID_BG = "#18181b";

/** Inner shadow + lift partagés. */
export const TOOLTIP_SHADOW =
  "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.08), 0 6px 20px rgba(0,0,0,0.45)";

/** Bordure subtile partagée. */
export const PANEL_BORDER = "1px solid rgba(255,255,255,0.1)";

/** Fond des surfaces élevées (dropdown). */
export const ELEVATED_BG = "#272729";

/** Fond hover / item actif. */
export const HOVER_BG = "#2e2e31";

/** Texte atténué (icônes de menu). */
export const MUTED = "#c4c4c8";

/** Accent primaire (coche de sélection). */
export const PRIMARY = "#60a5fa";

/** Fond du Button variant secondary (repos, translucide — sur fond app). */
export const SECONDARY_BG = "rgba(255,255,255,0.04)";
export const SECONDARY_BG_HOVER = "rgba(255,255,255,0.08)";

/** Surface secondary **opaque** (tint blanc/4 composé sur fond sombre) — barre + tooltip. */
export const SECONDARY_SURFACE =
  "linear-gradient(rgba(255,255,255,0.04), rgba(255,255,255,0.04)), #18181b";

/** Bordure secondary partagée. */
export const SECONDARY_BORDER = "1px solid rgba(255,255,255,0.08)";

/** Ombre du Button secondary (`shadow-btn-neutral`). */
export const BTN_SHADOW =
  "0px -1px 0px 0px rgba(255,255,255,.06), 0px 0px 0px 1px rgba(255,255,255,.06), 0px 0px 0px 1px rgba(39,39,42,1), 0px 0px 1px 1.5px rgba(0,0,0,.24), 0px 2px 2px 0px rgba(0,0,0,.24)";

/** Ombre de carte élevée (`shadow-elevation-card-rest`, dropdown). */
export const CARD_SHADOW =
  "0px 0px 0px 1px rgba(0,0,0,.08), 0px 1px 2px -1px rgba(0,0,0,.08), 0px 2px 4px 0px rgba(0,0,0,.04)";

/** Ombre du Button primary (`shadow-btn-primary`, checkbox cochée). */
export const BTN_PRIMARY_SHADOW =
  "0px 0px 0px 1px rgba(0,0,0,.14), 0px -1px 0px 0px rgba(0,0,0,.08), 0px 1px 3px 0px rgba(0,0,0,.16), 0px 2px 4px 0px rgba(0,0,0,.08)";

/** Bordure de la checkbox décochée (`border-secondary`). */
export const CHECKBOX_BORDER = "rgba(255,255,255,0.16)";

/** Fond de la checkbox cochée (`btn-primary-bg`). */
export const CHECKBOX_CHECKED_BG = "#fafafa";

/** Couleur de la coche (`btn-primary-text`). */
export const CHECKBOX_CHECK = "#09090b";
