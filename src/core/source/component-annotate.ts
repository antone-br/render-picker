import { resolvePosition } from "./source-map-resolver";

/**
 * Annote chaque élément DOM rendu par React avec `data-component` (nom du
 * composant le plus proche) et `data-source` (`src/.../file.tsx:118`), depuis
 * `_debugStack`. Deux formats de frame supportés :
 * - **Turbopack** dev : frame chunk `…/_next/static/chunks/*._.js:l:c` → décodée
 *   via la sourcemap du chunk.
 * - **Webpack** dev : frame `webpack-internal:///(app-pages-browser)/./src/….tsx:l:c`
 *   → le chemin source original est déjà dans la frame (pas de sourcemap).
 * Nécessaire depuis React 19 qui a supprimé `_debugSource`. Dev only.
 */

type DebugInfoEntry = {
  name?: string;
};

type Fiber = {
  type: unknown;
  return: Fiber | null;
  _debugOwner?: Fiber | null;
  _debugInfo?: unknown[];
  _debugStack?: { stack?: string };
};

const FIBER_KEY_PREFIX = "__reactFiber$";
// URL de chunk Turbopack `:ligne:col`, AVEC ou SANS nom de fonction/parenthèses :
// V8 formate les callbacks arrow anonymes sans `nom (…)` (`at <url>:l:c`) — ces
// frames (ex. `<Tag/>` créé dans `.map(u => …)`) doivent matcher, sinon on retombe
// sur la fonction englobante (mauvaise ligne).
const STACK_FRAME_RE =
  /(https?:\/\/[^\s()]+?\/_next\/static\/chunks\/[^\s()]+?\._\.js):(\d+):(\d+)/;

export interface AnnotateResult {
  component: string;
  source: string | null;
}

export function componentInfo(el: HTMLElement): AnnotateResult | null {
  const fiber = getFiber(el);
  if (!fiber) return null;

  let current: Fiber | null = fiber;
  while (current) {
    const name = fiberName(current);
    if (name) {
      return { component: name, source: null };
    }
    current = current.return;
  }
  return null;
}

function displayNameOf(type: unknown): string | null {
  const fn = type as { displayName?: string; name?: string } | null;
  return fn?.displayName || fn?.name || null;
}

function fiberName(fiber: Fiber): string | null {
  const direct = displayNameOf(fiber.type);
  if (direct) return direct;

  let owner: Fiber | null | undefined = fiber._debugOwner;
  while (owner) {
    const ownerName = displayNameOf(owner.type);
    if (ownerName) return ownerName;
    owner = owner._debugOwner;
  }

  if (fiber._debugInfo)
    for (const entry of fiber._debugInfo) {
      const name = (entry as DebugInfoEntry)?.name;
      if (name) return name;
    }

  return null;
}

// Frame Webpack dev : le chemin source original est déjà présent dans le stack.
// - client : `webpack-internal:///(app-pages-browser)/./src/x.tsx:l:c`
// - serveur (RSC) : `about://React/Server/webpack-internal:///(rsc)/./src/(group)/x.tsx?855:l:c`
// - legacy : `src\app\[locale]\layout.tsx:l:c`
// Le chemin peut contenir des parenthèses (route groups `(marketing)`) et des crochets
// (`[locale]`), et être suivi d'une query `?<id>` (RSC) avant `:ligne:col`. Démarrage
// ancré sur une frontière (`/`, `(`, espace, début) pour éviter `node_modules` et `mysrc`.
const DIRECT_SOURCE_RE =
  /(?:^|[\s(/])((?:src|app)\/.+?\.(?:tsx?|jsx?))(?:\?[^\s:)]*)?:(\d+):(\d+)/g;

/**
 * Frames Webpack dev du stack contenant **directement** le chemin source
 * (`src/….tsx:ligne`), ordre d'apparition. Pur / testable. Les frames
 * `node_modules/…` (dont render-picker) ne commencent pas par `src/`|`app/` → ignorées.
 */
export function extractDirectSources(
  stackText: string,
): { source: string; line: number }[] {
  const text = stackText.replace(/\\/g, "/");
  const out: { source: string; line: number }[] = [];
  const re = new RegExp(DIRECT_SOURCE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ source: m[1]!, line: Number(m[2]) });
  }
  return out;
}

/** Frames `_next/static/chunks/*.js` du stack jsxDEV — premiers candidats. */
function stackCandidates(
  stack: { stack?: string } | undefined,
): { url: string; line: number; col: number }[] {
  const text = stack?.stack;
  if (!text) return [];
  const frames: { url: string; line: number; col: number }[] = [];
  const regex = new RegExp(STACK_FRAME_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    frames.push({ url: m[1]!, line: Number(m[2]), col: Number(m[3]) });
  }
  return frames;
}

function getFiber(el: HTMLElement): Fiber | null {
  for (const key in el) {
    if (key.startsWith(FIBER_KEY_PREFIX)) {
      return el[key as keyof HTMLElement] as unknown as Fiber;
    }
  }
  return null;
}

const SOURCE_RE = /(?:^|)(?:src|app)\/[^?]*\.(?:tsx?|jsx?|css)$/;
const PROCESSED_KEY = "__rfComponentTraceDone__";

export function annotateTree(root: HTMLElement | Document): number {
  const els = root.querySelectorAll<HTMLElement>("*");
  let count = 0;
  for (const el of els) {
    if (annotate(el)) count++;
  }
  return count;
}

export function annotate(el: HTMLElement): boolean {
  const done = (el as never as Record<string, boolean>)[PROCESSED_KEY];
  if (done) return false;

  const info = componentInfo(el);
  if (!info) return false;

  (el as never as Record<string, boolean>)[PROCESSED_KEY] = true;
  el.setAttribute("data-component", info.component);

  const fiber = getFiber(el);
  if (!fiber || !fiber._debugStack) return true;

  resolveFirstSource(fiber._debugStack).then(async (source) => {
    if (source) el.setAttribute("data-source", source);
    // Fichier d'usage : où le composant est écrit (≠ son module). React ne met pas
    // le frame parent dans le `_debugStack` de l'élément → on remonte `_debugOwner`.
    const owner = await resolveOwnerSource(fiber, fileOf(source));
    if (owner) el.setAttribute("data-owner-source", owner);
  });
  return true;
}

/** Enlève `:ligne(:col)` d'un `source` pour comparer les fichiers. */
function fileOf(source: string | null): string | null {
  return source ? source.replace(/:\d+(?::\d+)?$/, "") : null;
}

/** 1re frame `src/app` résolue du stack → `"fichier:ligne"`. */
async function resolveFirstSource(stack: {
  stack?: string;
}): Promise<string | null> {
  // Webpack dev : chemin source déjà dans la frame (pas de sourcemap).
  for (const f of extractDirectSources(stack.stack ?? "")) {
    if (SOURCE_RE.test(f.source)) return `${f.source}:${f.line}`;
  }
  // Turbopack : frame chunk → sourcemap.
  for (const frame of stackCandidates(stack)) {
    const resolved = await resolvePosition(frame.url, frame.line, frame.col);
    if (resolved && SOURCE_RE.test(resolved.source)) {
      return `${resolved.source}:${resolved.line}`;
    }
  }
  return null;
}

/**
 * Remonte la chaîne `_debugOwner` et retourne le 1er site d'usage dont le fichier
 * diffère de `sourceFile` (= là où le composant est instancié, hors de son module).
 */
async function resolveOwnerSource(
  fiber: Fiber,
  sourceFile: string | null,
): Promise<string | null> {
  let owner: Fiber | null | undefined = fiber._debugOwner;
  let depth = 0;
  while (owner && depth < 12) {
    if (owner._debugStack) {
      const s = await resolveFirstSource(owner._debugStack);
      if (s && fileOf(s) !== sourceFile) return s;
    }
    owner = owner._debugOwner;
    depth++;
  }
  return null;
}

/** Annote le DOM puis suit les mutations. Retourne une fonction d'arrêt. */
export function initComponentAnnotator(): () => void {
  let queued = false;
  let frame: number | null = null;
  const run = () => {
    queued = false;
    frame = null;
    if (!document.body) return;
    annotateTree(document.body);
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    frame = requestAnimationFrame(run);
  };
  const observer = new MutationObserver(queue);
  const start = () => {
    annotateTree(document.body);
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
