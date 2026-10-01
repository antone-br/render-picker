/**
 * Génère le XPath d'un élément. Pur / testable.
 *
 * - `id` présent → `//*[@id="x"]` (plus court et stable).
 * - élément dans un SVG → on vise le `<svg>` lui-même (pas de chemin dans les
 *   internes SVG, qui ont des namespaces à part).
 * - sinon on remonte jusqu'à `<html>` : un ancêtre porteur d'`id` ancre le chemin
 *   (`//*[@id="x"]/…`), et chaque segment reçoit un index `[n]` s'il a plusieurs
 *   frères de même tag.
 */
export function getXPath(el: Element): string {
  if (el.id) return `//*[@id="${el.id}"]`;

  const parts: string[] = [];
  let current: Element | null = el.closest("svg") ?? el;

  while (
    current &&
    current.nodeType === 1 &&
    current !== document.documentElement
  ) {
    const tag = current.tagName.toLowerCase();

    if (current !== el && current.id) {
      parts.unshift(`*[@id="${current.id}"]`);
      return `//${parts.join("/")}`;
    }

    const parent: Element | null = current.parentElement;
    let segment = tag;
    if (parent) {
      const sameTag = Array.from(parent.children).filter(
        (c) => c.tagName.toLowerCase() === tag,
      );
      if (sameTag.length > 1) {
        segment = `${tag}[${sameTag.indexOf(current) + 1}]`;
      }
    }
    parts.unshift(segment);
    current = parent;
  }

  return `/html/${parts.join("/")}`;
}
