/**
 * Constantes de style partagées par l'inspecteur (overlay, markers, tooltip,
 * HUD) et par l'UI React (`react.tsx`). Aucun effet de bord : pures valeurs.
 */

/** Accent du picker (même bleu que le flash Ctrl+clic). */
export const ACCENT = "#3b82f6";

/** Fond solide (sans opacité) partagé tooltip / bulle / toast. */
export const SOLID_BG = "#18181b";

/** Inner shadow + lift partagés. */
export const TOOLTIP_SHADOW =
  "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.08), 0 6px 20px rgba(0,0,0,0.45)";

/** Bordure subtile partagée. */
export const PANEL_BORDER = "1px solid rgba(255,255,255,0.1)";

/** z-index des surfaces flottantes de l'inspecteur. */
export const OVERLAY_Z = 2147482000;

/** z-index des surfaces React (bouton, barre, dropdown, toast) — au-dessus de l'overlay. */
export const UI_Z = 2147483000;

/** Teinte de l'overlay de survol (fond translucide). */
export const HIGHLIGHT_BG = "rgba(59,130,246,0.15)";

/** Teinte d'un élément retenu dans la sélection multiple. */
export const SELECTED_BG = "rgba(59,130,246,0.24)";

/** Bordure de l'overlay / des markers. */
export const HIGHLIGHT_BORDER = `2px solid ${ACCENT}`;

/** Rayon des coins de l'overlay de survol (réutilisé par la viz padding). */
export const OVERLAY_RADIUS = "3px";

/**
 * Transition de l'overlay de survol : la géométrie glisse d'un élément à l'autre
 * (ease-out doux), l'opacité fond plus vite. Repris du rectangle de renderflow.
 */
export const OVERLAY_GLIDE =
  "top .2s cubic-bezier(.25,.1,.25,1), left .2s cubic-bezier(.25,.1,.25,1), width .2s cubic-bezier(.25,.1,.25,1), height .2s cubic-bezier(.25,.1,.25,1), opacity .12s ease-out";

/**
 * Neutralise les `pointer-events` des éléments désactivés pour que le hit-test
 * (`elementFromPoint`) les atteigne quand même.
 */
export const PICKING_CSS =
  ':disabled,[disabled],[aria-disabled="true"]{pointer-events:none!important}';

/* --- Visualisation layout (dropdown paramètres) --- */

/** Remplissage du padding au survol (vert #B8C480, solide). */
export const PADDING_FILL = "#B8C480";
/** Remplissage des gaps (couleur exacte Chrome DevTools : #7F20D2 @ 0.3). */
export const GAP_FILL = "rgba(127,32,210,0.3)";
/** Hachures diagonales des gaps (Chrome DevTools) : GapHatch #7F20D2 @ 0.8 sur GapBackground @ 0.3. */
export const GAP_STRIPES =
  "repeating-linear-gradient(-45deg, rgba(127,32,210,0.8) 0, rgba(127,32,210,0.8) 1.5px, rgba(127,32,210,0.3) 1.5px, rgba(127,32,210,0.3) 6px)";
/** Contour pointillé autour du conteneur à gaps (Chrome GapHatch). */
export const GAP_DASH = "rgba(127,32,210,0.8)";
/** Remplissage de la marge au survol (#B08355, solide). */
export const MARGIN_FILL = "#B08355";

/* --- Palette UI reprise de renderflow (thème sombre) --- */

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

/* --- Checkbox (repris de renderflow) --- */

/** Ombre du Button primary (`shadow-btn-primary`, checkbox cochée). */
export const BTN_PRIMARY_SHADOW =
  "0px 0px 0px 1px rgba(0,0,0,.14), 0px -1px 0px 0px rgba(0,0,0,.08), 0px 1px 3px 0px rgba(0,0,0,.16), 0px 2px 4px 0px rgba(0,0,0,.08)";
/** Bordure de la checkbox décochée (`border-secondary`). */
export const CHECKBOX_BORDER = "rgba(255,255,255,0.16)";
/** Fond de la checkbox cochée (`btn-primary-bg`). */
export const CHECKBOX_CHECKED_BG = "#fafafa";
/** Couleur de la coche (`btn-primary-text`). */
export const CHECKBOX_CHECK = "#09090b";
