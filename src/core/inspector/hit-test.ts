import { IGNORE_ATTR, MAX_DESCEND } from "./constants/behavior";

/**
 * Hit-test de l'inspecteur. Fonctions pures (pas d'état) : trouvent l'élément
 * pickable réellement sous un point, en descendant dans les enfants rendus
 * `pointer-events:none` que `elementFromPoint` saute.
 */

/** Vrai si l'élément (ou un ancêtre) porte `data-pathpicker-ignore`. */
export function shouldIgnore(el: Element | null): boolean {
  return !!el?.closest?.(`[${IGNORE_ATTR}]`);
}

/** Vrai si le point tombe dans un des rects de l'élément (gère l'inline multi-lignes). */
export function containsPoint(el: Element, x: number, y: number): boolean {
  const rects = el.getClientRects?.();
  const list =
    rects && rects.length ? Array.from(rects) : [el.getBoundingClientRect()];
  return list.some(
    (r) =>
      r.width > 0 &&
      r.height > 0 &&
      x >= r.left &&
      x <= r.right &&
      y >= r.top &&
      y <= r.bottom,
  );
}

/** Enfant sauté par `elementFromPoint` (pointer-events:none) sous le point. */
export function skippedChildAt(el: Element, x: number, y: number): Element | null {
  const children = Array.from(el.children);
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i]!;
    if (shouldIgnore(child)) continue;
    if (!containsPoint(child, x, y)) continue;
    const cs = getComputedStyle(child);
    if (cs.pointerEvents !== "none") continue;
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;
    return child;
  }
  return null;
}

function isDisabled(el: Element): boolean {
  try {
    return el.matches(':disabled,[disabled],[aria-disabled="true"]');
  } catch {
    return false;
  }
}

/** Élément pickable sous (x, y), en descendant les couches `pointer-events:none`. */
export function resolveTarget(x: number, y: number): Element | null {
  const hit = document.elementFromPoint(x, y);
  if (!hit || shouldIgnore(hit)) return null;

  let current: Element = hit;
  for (let i = 0; i < MAX_DESCEND; i++) {
    // Un élément désactivé est la cible finale : `pointer-events:none` s'hérite à
    // tout son sous-arbre, ne pas descendre dedans (sinon on vise un enfant profond).
    if (isDisabled(current)) break;
    const child = skippedChildAt(current, x, y);
    if (!child) break;
    current = child;
  }
  return current;
}
