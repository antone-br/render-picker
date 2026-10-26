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

/**
 * Pose `data-source` / `data-component` sur chaque élément selon le marqueur de
 * commentaire qui le précède en ordre document. Idempotent (clé `PROCESSED_KEY`).
 * Retourne le nombre d'éléments nouvellement annotés.
 */
export function annotateFromComments(root: Node = document.body): number {
  if (!root) return 0;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
  );
  let currentSource: string | null = null;
  let currentComponent: string | null = null;
  let count = 0;

  let node: Node | null = walker.currentNode;
  // `currentNode` démarre sur `root` (un élément) — avancer d'abord.
  node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const marker = parseTplMarker((node as Comment).data);
      if (marker) {
        currentSource = `${marker.source}:${marker.line}`;
        currentComponent = basename(marker.source);
      }
    } else {
      const el = node as HTMLElement & Record<string, unknown>;
      if (!el[PROCESSED_KEY] && currentSource) {
        el[PROCESSED_KEY] = true;
        el.setAttribute("data-source", currentSource);
        if (currentComponent) el.setAttribute("data-component", currentComponent);
        count++;
      }
    }
    node = walker.nextNode();
  }
  return count;
}

/**
 * Annote le DOM puis suit les mutations (rAF-coalescé). Retourne une fonction
 * d'arrêt. Calqué sur `initComponentAnnotator`.
 */
export function initTplAnnotator(): () => void {
  let queued = false;
  let frame: number | null = null;
  const run = () => {
    queued = false;
    frame = null;
    if (!document.body) return;
    annotateFromComments(document.body);
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    frame = requestAnimationFrame(run);
  };
  const observer = new MutationObserver(queue);
  const start = () => {
    annotateFromComments(document.body);
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
