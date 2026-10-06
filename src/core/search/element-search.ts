import { getCssSelector } from "../inspector/css-selector";
import { getXPath } from "../inspector/xpath";
import type { PickResult } from "../types";

/**
 * Recherche d'éléments dans le DOM par tag (`div`), classe (`.card`), sélecteur
 * CSS direct (`div.card`, `input[type=checkbox]`) ou mot libre (tag OU classe).
 * L'UI du picker hôte (`data-pathpicker-ignore`) est exclue. Pure sauf lecture DOM.
 */

/** La recherche ne retourne jamais plus de résultats (liste de l'UI lisible). */
export const SEARCH_MAX_RESULTS = 50;

/** Attribut marquant l'UI de recherche (popover + rects) — ferme le clic-hors. */
export const SEARCH_UI_ATTR = "data-rp-search-ui";

/** Élément hôte du picker — exclu des résultats. */
const IGNORE_SELECTOR = "[data-pathpicker-ignore]";

const WORD_RE = /^[a-zA-Z][\w-]*$/;

/** Résultats dans l'ordre du document (querySelectorAll le garantit déjà). */
export function searchElements(
  query: string,
  root: Document | HTMLElement = document,
): HTMLElement[] {
  const selector = toSelector(query);
  if (!selector) return [];

  let matches: NodeListOf<HTMLElement>;
  try {
    matches = root.querySelectorAll<HTMLElement>(selector);
  } catch {
    // Sélecteur CSS invalide → aucun résultat.
    return [];
  }

  const results: HTMLElement[] = [];
  for (const el of matches) {
    if (results.length >= SEARCH_MAX_RESULTS) break;
    if (!el.isConnected) continue;
    if (el.closest(IGNORE_SELECTOR)) continue;
    results.push(el);
  }
  return results;
}

/**
 * Traduit la requête en sélecteur CSS, ou `null` (requête vide/invalide).
 * - `div`, `form`, `input` → tag exact + classe portant ce nom
 * - `.card`, `#id`, `div.card`, `input[type=text]` → CSS brut
 * - nom de composant React (`Button`) → attribut `data-component` posé par
 *   l'annotator — actif uniquement dans le package npm (l'extension n'annote pas).
 */
export function toSelector(query: string): string | null {
  const q = query.trim();
  if (!q) return null;

  const isSimpleWord = WORD_RE.test(q);
  if (!isSimpleWord) {
    // Tout le reste = sélecteur CSS brut → validé par la lecture (try/catch).
    return q;
  }

  // Mot libre : tag exact OU classe portant ce nom OU composant React.
  const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(q) : q;
  return `${q}, .${escaped}, [data-component="${q}" i]`;
}

/** Résultat pické (partiel, sans React) construit depuis un élément trouvé. */
export function pickResultFromElement(
  el: HTMLElement,
  route: string,
): PickResult {
  return {
    route,
    xpath: getXPath(el),
    cssSelector: getCssSelector(el),
    tagName: el.tagName.toLowerCase(),
    id: el.id || null,
    reactComponent: null,
    reactSource: null,
  };
}
