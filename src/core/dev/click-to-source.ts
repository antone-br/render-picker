import { loadSettings, modifierMatches } from "../settings";
import type { ClickTrigger, RenderPickerSettings } from "../settings";

/**
 * Clic (modificateur configurable) sur un élément annoté → ouvre dans VS Code sa
 * source exacte (`data-source`) ou son fichier d'**usage** (`data-owner-source`, là
 * où le composant est écrit, pas sa définition partagée). Défauts : Alt+clic →
 * source, Ctrl+clic → usage. Les liaisons viennent de `settings.commands`. Dev only.
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

/** Resolver courant (init npm actif) — emploi externe (rects de recherche). */
let vscodeOpenRef: ((el: HTMLElement, action: "source" | "usage") => void) | null = null;

/**
 * Résout l'action VS Code (source/usage) pour un état modificateurs, selon les
 * bindings de `settings.commands` (usage prioritaire). Pur / testable.
 */
export function vscodeActionFor(
  e: { ctrlKey: boolean; altKey: boolean; metaKey: boolean; shiftKey: boolean },
  kind: ClickTrigger = "click",
): "source" | "usage" | null {
  const { source, usage } = loadSettings().commands;
  if (usage.trigger === kind && modifierMatches(usage.modifier, e)) return "usage";
  if (source.trigger === kind && modifierMatches(source.modifier, e)) return "source";
  return null;
}

/**
 * Ouvre l'élément dans VS Code pour l'action donnée — `false` si le resolver
 * npm n'est pas actif (extension).
 */
export function vscodeOpenFor(el: HTMLElement, action: "source" | "usage"): boolean {
  if (!vscodeOpenRef) return false;
  vscodeOpenRef(el, action);
  return true;
}

/**
 * Enregistre les listeners (clic / clic droit / double-clic) en capture selon les
 * liaisons `settings.commands.source` / `.usage`. Retourne une fonction d'arrêt.
 * `root` = racine absolue du projet (ex. `process.env.NEXT_PUBLIC_PROJECT_ROOT`).
 */
export function initClickToSource(
  root: string | undefined | null,
  getCommands: () => RenderPickerSettings["commands"] = () => loadSettings().commands,
): () => void {
  if (!root) {
    console.warn(
      "[render-picker] projectRoot absent (NEXT_PUBLIC_PROJECT_ROOT non injecté ?) — ouverture VS Code désactivée.",
    );
    return () => {};
  }

  // Supprime le click/pointerup consécutif au geste pour éviter que l'action
  // native de l'élément se déclenche après l'ouverture dans VS Code.
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

  /** Quelle action (source/usage) matche ce geste, ou `null`. Usage prioritaire. */
  function resolveAction(
    e: MouseEvent,
    kind: ClickTrigger,
  ): "source" | "usage" | null {
    const { source, usage } = getCommands();
    if (usage.trigger === kind && modifierMatches(usage.modifier, e)) return "usage";
    if (source.trigger === kind && modifierMatches(source.modifier, e)) return "source";
    return null;
  }

  /** Ouvre la cible dans VS Code pour l'action résolue. */
  function open(e: MouseEvent, action: "source" | "usage"): void {
    const target = e.target as HTMLElement | null;
    const el = target?.closest<HTMLElement>("[data-source]");
    if (!el) return;
    openEl(el, action);
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  /** Ouvre VS Code : VS Code URI + désarmement + flash (enregistré via `resolveVscodeOpen`). */
  function openEl(el: HTMLElement, action: "source" | "usage"): void {
    const rel =
      action === "usage"
        ? el.getAttribute("data-owner-source") ?? el.getAttribute("data-source")
        : el.getAttribute("data-source");
    const uri = buildVscodeUri(root, rel);
    if (!uri) return;

    // Désarme le picker s'il est armé (notre inspecteur annule sur Escape).
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    // Avale les events suivants (click/pointerup) issus de ce même geste.
    suppressNext = true;
    if (suppressTimer) clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => {
      suppressNext = false;
    }, 500);

    // Flash visuel bref pour confirmer la cible.
    const prevOutline = el.style.outline;
    el.style.outline = "2px solid #3b82f6";
    setTimeout(() => {
      el.style.outline = prevOutline;
    }, 400);

    const a = document.createElement("a");
    a.href = uri;
    a.click();
  }

  vscodeOpenRef = openEl;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const action = resolveAction(e, "click");
    if (action) open(e, action);
  };
  const onContextMenu = (e: MouseEvent) => {
    const action = resolveAction(e, "rightclick");
    if (action) open(e, action);
  };
  const onDblClick = (e: MouseEvent) => {
    const action = resolveAction(e, "dblclick");
    if (action) open(e, action);
  };

  window.addEventListener("pointerdown", onPointerDown, { capture: true });
  window.addEventListener("contextmenu", onContextMenu, { capture: true });
  window.addEventListener("dblclick", onDblClick, { capture: true });

  return () => {
    window.removeEventListener("pointerdown", onPointerDown, { capture: true });
    window.removeEventListener("contextmenu", onContextMenu, { capture: true });
    window.removeEventListener("dblclick", onDblClick, { capture: true });
    for (const type of SWALLOWED_EVENTS) {
      window.removeEventListener(type, swallow, { capture: true });
    }
    if (suppressTimer) clearTimeout(suppressTimer);
  };
}
