/**
 * Ctrl+clic sur un élément annoté (`data-source`) → ouvre le fichier source
 * à la ligne dans VS Code via `vscode://file/<abs>:<line>`. Dev only.
 */

/**
 * Construit l'URI VS Code à partir de la racine projet absolue et du `data-source`
 * relatif (`src/.../file.tsx:118`). Pur / testable.
 */
export function buildVscodeUri(
  root: string | undefined | null,
  source: string | null,
): string | null {
  if (!root || !source) return null;
  const normalizedRoot = root.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalizedRoot) return null;
  const rel = source.replace(/^\/+/, "");
  return `vscode://file/${normalizedRoot}/${rel}`;
}

const SWALLOWED_EVENTS = ["click", "auxclick", "pointerup", "mouseup"] as const;

/**
 * Enregistre le listener Ctrl+clic en capture. Retourne une fonction d'arrêt.
 * `root` = racine absolue du projet (ex. `process.env.NEXT_PUBLIC_PROJECT_ROOT`).
 */
export function initClickToSource(root: string | undefined | null): () => void {
  if (!root) {
    console.warn(
      "[render-picker] projectRoot absent (NEXT_PUBLIC_PROJECT_ROOT non injecté ?) — Ctrl+clic désactivé.",
    );
    return () => {};
  }

  // Supprime le click/pointerup consécutif au Ctrl+clic pour éviter que
  // l'action native de l'élément se déclenche après l'ouverture dans VS Code.
  let suppressNext = false;
  let suppressTimer: ReturnType<typeof setTimeout> | null = null;
  const swallow = (e: Event) => {
    if (!suppressNext) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  for (const type of SWALLOWED_EVENTS) {
    window.addEventListener(type, swallow, { capture: true });
  }

  const handler = (e: PointerEvent) => {
    if (!e.ctrlKey || e.button !== 0) return;
    const target = e.target as HTMLElement | null;

    const el = target?.closest<HTMLElement>("[data-source]");
    if (!el) return;

    const uri = buildVscodeUri(root, el.getAttribute("data-source"));
    if (!uri) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    // Désarme le picker s'il est armé : notre inspecteur annule sur Escape.
    // Inoffensif si le picker n'est pas actif.
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    // Avale les events suivants (click/pointerup) issus de ce même Ctrl+clic
    suppressNext = true;
    if (suppressTimer) clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => {
      suppressNext = false;
    }, 500);

    // Flash visuel bref pour confirmer la cible
    const prevOutline = el.style.outline;
    el.style.outline = "2px solid #3b82f6";
    setTimeout(() => {
      el.style.outline = prevOutline;
    }, 400);

    const a = document.createElement("a");
    a.href = uri;
    a.click();
  };

  window.addEventListener("pointerdown", handler, { capture: true });

  return () => {
    window.removeEventListener("pointerdown", handler, { capture: true });
    for (const type of SWALLOWED_EVENTS) {
      window.removeEventListener(type, swallow, { capture: true });
    }
    if (suppressTimer) clearTimeout(suppressTimer);
  };
}
