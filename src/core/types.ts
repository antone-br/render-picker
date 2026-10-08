import type { RenderPickerSettings } from "./settings";

export type ResolvedPosition = {
  source: string;
  line: number;
  column: number;
};

/**
 * Résultat d'un pick. `route`/`xpath`/`cssSelector`/`tagName`/`id` sont produits
 * par l'inspecteur ; `reactComponent`/`reactSource` sont complétés par
 * `enrichResult` depuis les attributs `data-component`/`data-source`.
 */
export interface PickResult {
  /** Route courante (`pathname`). */
  route: string;
  /** XPath de l'élément. */
  xpath: string;
  /** Sélecteur CSS de l'élément. */
  cssSelector: string;
  /** Nom du tag en minuscules. */
  tagName: string;
  /** `id` de l'élément, ou `null`. */
  id: string | null;
  /** Nom du composant React le plus proche, ou `null`. */
  reactComponent: string | null;
  /** `fichier:ligne` source résolu, ou `null`. */
  reactSource: string | null;
}

/** Branche l'inspecteur impératif sur la couche React/UI. */
export interface InspectorCallbacks {
  /** Pick simple (clic) → résultat partiel (sans enrichissement React). */
  onPick: (result: PickResult) => void;
  /** Confirmation d'une sélection multiple (Entrée). */
  onPickMany?: (results: PickResult[]) => void;
  /** Désarmement (Échap). */
  onCancel: () => void;
  /** Fournit la route courante au moment du pick. */
  getRoute: () => string;
  /** Accumulation Maj+clic. Défaut : `true` (si `onPickMany` fourni). */
  multi?: boolean;
  /** Visualisations layout à dessiner au survol. Lu à chaque survol. */
  getOverlays?: () => LayoutOverlays;
  /** Liaisons des commandes (copy/multi/confirm/cancel). Lu à chaque event. */
  getCommands?: () => RenderPickerSettings["commands"];
  /** Titre du tooltip (défaut : nom du composant). L'extension passe les classes. */
  getTitle?: (el: Element, selection: Element[]) => string;
  /** Ouvre le panneau d'inspection pour l'élément (touche `inspect`). */
  onInspect?: (el: Element) => void;
  /** Ouvre le menu contextuel (remappable `copyHtml` : copier HTML / classes). */
  onContextMenu?: (el: Element, pos: { x: number; y: number }) => void;
  /** Élément survolé par le picker (nouveau survol) — pour révéler dans l'arbre HTML. */
  onHover?: (el: Element) => void;
  /** Notifié à chaque changement du nombre d'éléments sélectionnés. */
  onSelectionChange?: (count: number) => void;
}

/** Visualisations layout optionnelles dessinées au survol. */
export interface LayoutOverlays {
  /** Afficher le padding de l'élément (vert). */
  padding: boolean;
  /** Afficher les gaps flex/grid (violet). */
  gap: boolean;
  /** Afficher la marge de l'élément (#B08355). */
  margin: boolean;
}
