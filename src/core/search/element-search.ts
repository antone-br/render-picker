import { getCssSelector } from "../inspector/css-selector";
import { getXPath } from "../inspector/xpath";
import type { PickResult } from "../types";

/**
 * Recherche d'éléments dans le DOM par tag (`div`), classe (`.card`), sélecteur
 * CSS direct (`div.card`, `input[type=checkbox]`) ou mot libre (tag OU classe).
 * Frappe partielle : `div.` (tag seul), `div.car` (préfixe de classe), `.car`
 * (sans tag) → autocomplétion par préfixe de classe. L'UI du picker hôte
 * (`data-pathpicker-ignore`) est exclue. Pure sauf lecture DOM.
 */

/** La recherche ne retourne jamais plus de résultats (liste de l'UI lisible). */
export const SEARCH_MAX_RESULTS = 50;

/** Attribut marquant l'UI de recherche (popover + rects) — ferme le clic-hors. */
export const SEARCH_UI_ATTR = "data-rp-search-ui";

/** Élément hôte du picker — exclu des résultats. */
const IGNORE_SELECTOR = "[data-pathpicker-ignore]";

const WORD_RE = /^[a-zA-Z][\w-]*$/;

/** Requête partielle autocomplétable : `tag?` + `.prefix?` (dot requis). */
const PARTIAL_RE = /^([a-zA-Z][\w-]*)?\.(\w*)$/;

/** Résultats dans l'ordre du document (querySelectorAll le garantit déjà). */
export function searchElements(
  query: string,
  root: Document | HTMLElement = document,
): HTMLElement[] {
  const partial = PARTIAL_RE.exec(query.trim());
  if (partial) return searchPartial(partial[1] ?? null, partial[2] ?? "");

  const selector = toSelector(query);
  if (!selector) return [];

  let matches: NodeListOf<HTMLElement>;
  try {
    matches = root.querySelectorAll<HTMLElement>(selector);
  } catch {
    // Sélecteur CSS invalide → aucun résultat.
    return [];
  }

  return collect(matches);
}

function collect(matches: NodeListOf<HTMLElement>): HTMLElement[] {
  const results: HTMLElement[] = [];
  for (const el of matches) {
    if (results.length >= SEARCH_MAX_RESULTS) break;
    if (!el.isConnected) continue;
    if (el.closest(IGNORE_SELECTOR)) continue;
    results.push(el);
  }
  return results;
}

/** Autocomplétion : éléments du tag (ou du DOM entier) filtrés par préfixe de classe. */
function searchPartial(
  tag: string | null,
  prefix: string,
  root: Document | HTMLElement = document,
): HTMLElement[] {
  let candidates: NodeListOf<HTMLElement>;
  try {
    candidates = root.querySelectorAll<HTMLElement>(tag ?? "*");
  } catch {
    return [];
  }
  const results: HTMLElement[] = [];
  const lower = prefix.toLowerCase();
  const anyClass = lower === "";
  for (const el of candidates) {
    if (results.length >= SEARCH_MAX_RESULTS) break;
    if (!el.isConnected) continue;
    if (el.closest(IGNORE_SELECTOR)) continue;
    const raw = el.getAttribute("class"); // couvre SVG (className = objet)
    if (!anyClass) {
      // Préfixe demandé : pas de classe = écarté (sinon tous passeraient).
      const hit = raw ? raw
        .trim()
        .split(/\s+/)
        .some((cls) => cls.toLowerCase().startsWith(lower)) : false;
      if (!hit) continue;
    }
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

/**
 * Échappe un token de classe pour un sélecteur CSS Tailwind-safe : `md:px-6`
 * contient un `:` (pseudo-classe!) → `.md\:px-6`. L'affichage garde le brut.
 * (CSS.escape absent de certains environnements → fallback manuel.)
 */
export function escapeClassToken(token: string): string {
  if (WORD_RE.test(token)) return token;
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(token);
  if (/^[0-9]/.test(token)) return `\\3${token} `;
  return token.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

/** Suggestion = sélecteur (tag + premières classes) regroupant plusieurs éléments. */
export interface SearchGroup {
  /** Clé du groupe = affichage lisible (`div.h-full.px-4.md:px-6`). */
  key: string;
  /** Sélecteur valide pour `querySelectorAll` (tokens échappés). */
  selector: string;
  tag: string;
  cls: string;
  /** Nombre d'éléments du groupe. */
  count: number;
  /** Indices du groupe dans la liste plate (`searchElements`). */
  indices: number[];
}

/** Regroupe la liste plate en suggestions par sélecteur (ordre du document). */
export function groupResults(elements: HTMLElement[]): SearchGroup[] {
  const byKey = new Map<string, SearchGroup>();
  elements.forEach((el, i) => {
    const tag = el.tagName.toLowerCase();
    const attr = el.getAttribute("class"); // couvre SVG (className = objet)
    const rawTokens = attr && attr.trim() ? attr.trim().split(/\s+/).slice(0, 3) : [];
    const cls = rawTokens.length > 0 ? `.${rawTokens.join(".")}` : "";
    const escaped = rawTokens
      .map((t) => `.${escapeClassToken(t)}`)
      .join("");
    const key = `${tag}${cls}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, selector: `${tag}${escaped}`, tag, cls, count: 0, indices: [] };
      byKey.set(key, group);
    }
    group.count++;
    group.indices.push(i);
  });
  // Tri : du plus court au plus long en classe (les éléments nus d'abord).
  return Array.from(byKey.values()).sort((a, b) => a.cls.length - b.cls.length);
}
