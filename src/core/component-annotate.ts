import { resolvePosition } from "./source-map-resolver";

/**
 * Annote chaque élément DOM rendu par React avec `data-component` (nom du
 * composant le plus proche) et `data-source` (`src/.../file.tsx:118`, résolu
 * via la sourcemap du chunk depuis `_debugStack`). Nécessaire depuis React 19
 * qui a supprimé `_debugSource`. Dev only.
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
const STACK_FRAME_RE =
  /at [^(]+\((https?:\/\/[^)]+?\/_next\/static\/chunks\/[^)]+?\._\.js):(\d+):(\d+)\)/;

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

  resolveFirstSource(fiber._debugStack).then((source) => {
    if (source) el.setAttribute("data-source", source);
  });
  return true;
}

async function resolveFirstSource(stack: {
  stack?: string;
}): Promise<string | null> {
  for (const frame of stackCandidates(stack)) {
    const resolved = await resolvePosition(frame.url, frame.line, frame.col);
    if (resolved && SOURCE_RE.test(resolved.source)) {
      return `${resolved.source}:${resolved.line}`;
    }
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
