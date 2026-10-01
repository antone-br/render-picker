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

/** Teinte de l'overlay de survol (fond translucide). */
export const HIGHLIGHT_BG = "rgba(59,130,246,0.15)";

/** Teinte d'un élément retenu dans la sélection multiple. */
export const SELECTED_BG = "rgba(59,130,246,0.24)";

/** Bordure de l'overlay / des markers. */
export const HIGHLIGHT_BORDER = `2px solid ${ACCENT}`;

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
