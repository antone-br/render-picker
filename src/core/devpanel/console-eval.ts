/**
 * REPL du panneau console : évalue une expression JS dans le contexte global de
 * la page et route l'écho + le résultat (ou l'erreur) via `console.*`. Comme
 * `console.*` est patché par `console-capture`, la sortie va à la fois dans le
 * panneau render-picker et dans la vraie console DevTools. Sans React, sans effet
 * à l'import. No-op en SSR.
 */

/** Évalue `src` en portée globale et logge écho + résultat/erreur via `console.*`. */
export function runConsoleExpression(src: string): void {
  const code = src.trim();
  if (!code) return;
  if (typeof window === "undefined" || typeof console === "undefined") return;

  // Écho de la saisie (préfixe « › » pour distinguer la commande de sa sortie).
  console.log(`› ${code}`);

  try {
    // Eval indirect `(0, eval)` → portée globale (window), pas le scope du module.
    const result = (0, eval)(code);
    if (isThenable(result)) {
      result.then(
        (v) => console.log("⟵", v),
        (e) => console.error("⟵", e),
      );
      return;
    }
    console.log(result);
  } catch (e) {
    // throw synchrone, ReferenceError, ou eval bloqué par la CSP de la page.
    console.error(e);
  }
}

function isThenable(v: unknown): v is PromiseLike<unknown> {
  return (
    (typeof v === "object" || typeof v === "function") &&
    v !== null &&
    typeof (v as { then?: unknown }).then === "function"
  );
}
