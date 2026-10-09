/**
 * Génère le XPath d'un élément. Pur / testable.
 *
 * - `id` **stable** présent → `//*[@id="x"]` (plus court). Les ids auto-générés
 *   (React `useId`, headlessui, radix) sont ignorés (chemin positionnel).
 * - élément dans un SVG → on vise le `<svg>` lui-même (pas de chemin dans les
 *   internes SVG, qui ont des namespaces à part).
 * - sinon on remonte jusqu'à `<html>` : un ancêtre porteur d'`id` ancre le chemin
 *   (`//*[@id="x"]/…`), et chaque segment reçoit un index `[n]` s'il a plusieurs
 *   frères de même tag.
 */
/**
 * Vrai si l'`id` est stable (utilisable comme ancre). Rejette les ids auto-générés
 * (React `useId`, headlessui, radix) qui changent à chaque rendu. Pur.
 */
function isUsableId(id: string): boolean {
  return (
    !!id &&
    !id.includes(":") && // React 18 useId / radix (`:r3:`)
    !id.includes("«") && // variantes useId
    !id.includes("_r_") && // React 19 useId / headlessui (`..._r_3b_`)
    !/^(headlessui|radix)-/.test(id)
  );
}

export function getXPath(el: Element): string {
  if (isUsableId(el.id)) return `//*[@id="${el.id}"]`;

  const parts: string[] = [];
  let current: Element | null = el.closest("svg") ?? el;

  while (
    current &&
    current.nodeType === 1 &&
    current !== document.documentElement
  ) {
    const tag = current.tagName.toLowerCase();

    if (current !== el && isUsableId(current.id)) {
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
