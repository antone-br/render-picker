/**
 * Génère un sélecteur CSS court et (si possible) unique. Pur / testable.
 *
 * On ignore les classes « hash » générées (`css-xxxx`) qui changent à chaque
 * build. Les classes utilitaires (Tailwind `md:flex-row`, etc.) sont gardées
 * telles quelles — le sélecteur reflète ce que l'utilisateur voit, même si de
 * telles classes rendent le sélecteur invalide pour `querySelector` (géré).
 */

const HASH_CLASS_RE = /^css-[a-z0-9]+$/i;

/** Classes retenues (hors classes hash de build). */
function retainedClasses(el: Element): string[] {
  return Array.from(el.classList).filter((c) => !HASH_CLASS_RE.test(c));
}

/** `querySelectorAll` défensif : un sélecteur invalide compte comme non unique. */
function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/**
 * Segment d'un seul élément : `#id`, sinon `tag` + classes retenues, plus
 * `:nth-child(n)` si plusieurs frères partagent le même tag ET les mêmes classes.
 */
export function getElementSelector(el: Element): string {
  if (el.id) return `#${el.id}`;

  const tag = el.tagName.toLowerCase();
  const classes = retainedClasses(el);
  let selector = tag + classes.map((c) => `.${c}`).join("");

  const parent = el.parentElement;
  if (parent) {
    const classKey = classes.join(" ");
    const twins = Array.from(parent.children).filter(
      (s) =>
        s.tagName === el.tagName && retainedClasses(s).join(" ") === classKey,
    );
    if (twins.length > 1) {
      const index = Array.from(parent.children).indexOf(el) + 1;
      selector += `:nth-child(${index})`;
    }
  }

  return selector;
}

export function getCssSelector(el: Element): string {
  if (el.id) return `#${el.id}`;

  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;

  while (
    current &&
    current.nodeType === 1 &&
    current !== document.body &&
    depth < 5
  ) {
    const segment = getElementSelector(current);
    parts.unshift(segment);

    const combined = parts.join(" > ");
    if (isUnique(combined)) return combined;
    if (segment.startsWith("#")) break;

    current = current.parentElement;
    depth++;
  }

  return parts.join(" > ");
}
