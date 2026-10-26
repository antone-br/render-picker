/**
 * Producteur de `data-source` **non-React** pour les pages rendues en Smarty
 * (PrestaShop). Un prefilter Smarty (dev only, côté serveur) insère devant chaque
 * élément un commentaire marqueur `<!-- rp@<relpath>:<line> -->`. Cet adapter
 * parcourt le DOM en ordre document : le marqueur **immédiatement précédent** d'un
 * élément porte sa source (`fichier.tpl:ligne`). On pose alors `data-source` et
 * `data-component` (basename du `.tpl`) — le reste du pipeline (enrich, click-to-source)
 * est identique au chemin React. Dev only.
 */

const PROCESSED_KEY = "__rpTplDone__";

/** `rp@themes/x/foo.tpl:42` → `{ source, line }`. Pur / testable. */
export function parseTplMarker(text: string): { source: string; line: number } | null {
  const m = /^rp@(.+):(\d+)$/.exec(text.trim());
  if (!m) return null;
  return { source: m[1]!, line: Number(m[2]) };
}

/** Basename d'un chemin `.tpl` (`themes/x/foo.tpl` → `foo.tpl`). */
function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/** Nom du module PrestaShop d'un chemin (`modules/<nom>/…` → `<nom>`), sinon `null`. Pur. */
export function moduleNameFromSource(source: string): string | null {
  const m = /(?:^|\/)modules\/([^/]+)\//.exec(source);
  return m ? m[1]! : null;
}

/**
 * Libellé PrestaShop d'un élément, pour le tooltip de survol : nom du **module**
 * (`modules/<nom>/…`), sinon basename du `.tpl` (templates de thème). `null` pour une
 * source non-`.tpl` (pages React → comportement inchangé). Pur / testable.
 */
export function tplLabel(el: Element): string | null {
  const src = el.closest("[data-source]")?.getAttribute("data-source");
  if (!src) return null;
  const path = src.replace(/:\d+(?::\d+)?$/, "");
  const mod = moduleNameFromSource(path);
  if (mod) return mod;
  return /\.tpl$/.test(path) ? basename(path) : null;
}

/** Pose les attributs sur un élément non encore traité. Retourne 1 si annoté. */
function annotateEl(el: HTMLElement & Record<string, unknown>, source: string, component: string | null): number {
  if (el[PROCESSED_KEY]) return 0;
  el[PROCESSED_KEY] = true;
  el.setAttribute("data-source", source);
  if (component) el.setAttribute("data-component", component);
  return 1;
}

/**
 * Pose `data-source` / `data-component` sur chaque élément de `root` selon le marqueur
 * de commentaire qui le précède en ordre document. `seedSource` / `seedComponent`
 * amorcent la source courante (utile pour annoter un sous-arbre ajouté : on passe la
 * source du marqueur précédant ce sous-arbre). Idempotent. Retourne le nb d'éléments
 * nouvellement annotés.
 */
export function annotateFromComments(
  root: Node = document.body,
  seedSource: string | null = null,
  seedComponent: string | null = null,
): number {
  if (!root) return 0;
  let currentSource = seedSource;
  let currentComponent = seedComponent;
  let count = 0;

  // Annoter la racine elle-même (un sous-arbre ajouté commence par son propre élément).
  if (root.nodeType === Node.ELEMENT_NODE && currentSource) {
    count += annotateEl(root as HTMLElement & Record<string, unknown>, currentSource, currentComponent);
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
  );
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const marker = parseTplMarker((node as Comment).data);
      if (marker) {
        currentSource = `${marker.source}:${marker.line}`;
        currentComponent = basename(marker.source);
      }
    } else if (currentSource) {
      count += annotateEl(node as HTMLElement & Record<string, unknown>, currentSource, currentComponent);
    }
    node = walker.nextNode();
  }
  return count;
}

/** Nœud précédent en ordre document (dernier descendant du frère précédent, sinon parent). */
function previousInDocOrder(node: Node): Node | null {
  if (node.previousSibling) {
    let p: Node = node.previousSibling;
    while (p.lastChild) p = p.lastChild;
    return p;
  }
  return node.parentNode;
}

/** Marqueur le plus proche AVANT `start` en ordre document (borné). */
function precedingSource(start: Node): { source: string; component: string } | null {
  let n = previousInDocOrder(start);
  // Borne : évite un balayage total sur un élément sans marqueur amont (rare).
  for (let steps = 0; n && steps < 5000; steps++) {
    if (n.nodeType === Node.COMMENT_NODE) {
      const m = parseTplMarker((n as Comment).data);
      if (m) return { source: `${m.source}:${m.line}`, component: basename(m.source) };
    }
    n = previousInDocOrder(n);
  }
  return null;
}

/** Annote un sous-arbre ajouté : amorce avec le marqueur qui le précède. */
function annotateSubtree(el: Element): number {
  const pre = precedingSource(el);
  return annotateFromComments(el, pre?.source ?? null, pre?.component ?? null);
}

/**
 * Annote le DOM puis suit les mutations. Au lieu de re-parcourir tout le `body` à
 * chaque mutation (coûteux sur pages dynamiques), n'annote que les **sous-arbres
 * ajoutés** (rAF-coalescé). Retourne une fonction d'arrêt.
 */
export function initTplAnnotator(): () => void {
  const pending = new Set<Element>();
  let frame: number | null = null;

  const flush = () => {
    frame = null;
    for (const el of pending) {
      if (el.isConnected) annotateSubtree(el);
    }
    pending.clear();
  };
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const added of m.addedNodes) {
        if (added.nodeType === Node.ELEMENT_NODE) pending.add(added as Element);
      }
    }
    if (pending.size > 0 && frame === null) frame = requestAnimationFrame(flush);
  });
  const start = () => {
    annotateFromComments(document.body); // passe initiale complète
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  return () => {
    document.removeEventListener("DOMContentLoaded", start);
    observer.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
  };
}
