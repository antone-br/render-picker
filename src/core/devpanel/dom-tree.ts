/**
 * Helpers purs de l'arbre DOM (onglet HTML du panneau). Sans React, sans effet à
 * l'import. L'UI render-picker (`data-pathpicker-ignore`) est exclue de l'arbre.
 */

import { IGNORE_ATTR } from "../inspector/constants/behavior";

/** Longueur max du texte inline d'une feuille. */
const INLINE_TEXT_MAX = 80;

/** Décomposition lisible d'un élément : balise + id + classes. */
export interface NodeLabel {
  tag: string;
  id: string | null;
  classes: string[];
}

/** `tag` minuscule, `id` (ou `null`), liste des classes. Pur. */
export function nodeLabel(el: Element): NodeLabel {
  const raw = el.getAttribute("class"); // couvre SVG (className = objet)
  const classes = raw ? raw.trim().split(/\s+/).filter(Boolean) : [];
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes,
  };
}

/** Vrai si l'élément appartient à l'UI render-picker (exclu de l'arbre). Pur. */
export function isElementSkippable(el: Element): boolean {
  return el.closest(`[${IGNORE_ATTR}]`) !== null;
}

/** Enfants éléments visibles (hors UI render-picker). Pur. */
export function visibleChildren(el: Element): Element[] {
  const out: Element[] = [];
  for (const child of el.children) {
    if (!isElementSkippable(child)) out.push(child);
  }
  return out;
}

/**
 * Chaîne des ancêtres de `el` (parent → … → `root` inclus), pour déplier l'arbre
 * jusqu'à rendre `el` visible. `el` lui-même est exclu. Pur.
 */
export function ancestorsUpTo(el: Element, root: Element): Element[] {
  const chain: Element[] = [];
  let cur = el.parentElement;
  while (cur) {
    chain.push(cur);
    if (cur === root) break;
    cur = cur.parentElement;
  }
  return chain;
}

/**
 * Texte inline d'une feuille : si l'élément n'a aucun enfant **élément** et porte
 * du texte, renvoie ce texte (trimé, borné). Sinon `null`. Pur.
 */
export function inlineText(el: Element): string | null {
  if (visibleChildren(el).length > 0) return null;
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length > INLINE_TEXT_MAX ? `${text.slice(0, INLINE_TEXT_MAX)}…` : text;
}
