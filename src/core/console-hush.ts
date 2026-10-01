/**
 * Masque les logs "Download the React DevTools" / "[HMR] connected" /
 * "[Fast Refresh]" en dev. Simple filtre de console.
 */

export const DEFAULT_HUSH_RULES: readonly RegExp[] = [
  /Download the React DevTools/,
  /^\[HMR\] connected$/,
  /^\[Fast Refresh\]/,
];

type ConsoleMethod = "log" | "info" | "debug";
const METHODS: ConsoleMethod[] = ["log", "info", "debug"];

/** Patch console.log/info/debug. Retourne une fonction qui restaure l'original. */
export function hushConsoleNoise(
  rules: readonly RegExp[] = DEFAULT_HUSH_RULES,
): () => void {
  const originals = new Map<ConsoleMethod, (...args: unknown[]) => void>();
  for (const name of METHODS) {
    // eslint-disable-next-line no-console
    const original = console[name] as (...args: unknown[]) => void;
    originals.set(name, original);
    // eslint-disable-next-line no-console
    console[name] = (...args: unknown[]) => {
      const first = args[0];
      if (typeof first === "string" && rules.some((r) => r.test(first))) {
        return;
      }
      original.apply(console, args);
    };
  }
  return () => {
    for (const [name, original] of originals) {
      // eslint-disable-next-line no-console
      console[name] = original;
    }
  };
}
