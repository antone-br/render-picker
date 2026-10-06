import type { LogEntry } from "./store";

/**
 * Capture les `console.*` de la page dans un buffer via un callback, puis délègue
 * à l'original. Indépendant de `console-hush`. Retourne un cleanup qui restaure.
 */

type Level = LogEntry["level"];
const LEVELS: Level[] = ["log", "info", "warn", "error", "debug"];

const MAX_LEN = 2000;

/** Sérialise un argument console en texte court et sûr. */
function argToText(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg === "object") {
    try {
      return JSON.stringify(arg);
    } catch {
      return Object.prototype.toString.call(arg);
    }
  }
  return String(arg);
}

export function initConsoleCapture(onEntry: (e: LogEntry) => void): () => void {
  if (typeof console === "undefined") return () => {};
  const originals = new Map<Level, (...a: unknown[]) => void>();

  for (const level of LEVELS) {
    const original = console[level] as (...a: unknown[]) => void;
    originals.set(level, original);
    console[level] = (...args: unknown[]) => {
      try {
        const text = args.map(argToText).join(" ").slice(0, MAX_LEN);
        onEntry({ level, text, ts: Date.now() });
      } catch {
        // la capture ne doit jamais casser le log réel
      }
      original.apply(console, args);
    };
  }

  return () => {
    for (const [level, original] of originals) console[level] = original;
  };
}
