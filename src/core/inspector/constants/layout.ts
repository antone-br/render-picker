/**
 * Visualisation layout au survol (dropdown paramètres) : padding, gap, margin.
 * Couleurs calquées sur l'inspecteur d'éléments Chrome DevTools.
 */

/** Remplissage du padding au survol (vert #B8C480, solide). */
export const PADDING_FILL = "#B8C480";

/** Remplissage des gaps (couleur exacte Chrome DevTools : #7F20D2 @ 0.3). */
export const GAP_FILL = "rgba(127,32,210,0.3)";

/** Hachures diagonales des gaps (Chrome DevTools) : GapHatch #7F20D2 @0.8 (1px / 10px) sur GapBackground @0.3. */
export const GAP_STRIPES =
  "repeating-linear-gradient(-45deg, rgba(127,32,210,0.8) 0, rgba(127,32,210,0.8) 1px, rgba(127,32,210,0.3) 1px, rgba(127,32,210,0.3) 10px)";

/** Contour pointillé autour du conteneur à gaps (Chrome GapHatch). */
export const GAP_DASH = "rgba(127,32,210,0.8)";

/** Remplissage de la marge au survol (#B08355, solide). */
export const MARGIN_FILL = "#B08355";
