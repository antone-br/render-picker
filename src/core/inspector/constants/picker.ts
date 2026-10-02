/**
 * Constantes visuelles du picker : overlay de survol, markers, z-index, glisse,
 * CSS d'inspection. Pures valeurs, aucun effet de bord.
 */

/** Accent du picker (même bleu que le flash Ctrl+clic). */
export const ACCENT = "#3b82f6";

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
