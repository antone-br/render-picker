import { startCapture } from "./core/devpanel/capture";
import { NPM_MARKER_ATTR } from "./core/inspector/constants/behavior";
import { initClickToSource } from "./core/dev/click-to-source";
import { initComponentAnnotator } from "./core/source/component-annotate";
import { DEFAULT_HUSH_RULES, hushConsoleNoise } from "./core/dev/console-hush";

export interface RenderPickerOptions {
  /** Active l'outillage. Défaut : `process.env.NODE_ENV !== "production"`. */
  enabled?: boolean;
  /** Racine absolue du projet. Défaut : `process.env.NEXT_PUBLIC_PROJECT_ROOT`. */
  projectRoot?: string | null;
  /** Alt+clic → VS Code. Défaut : true. */
  clickToSource?: boolean;
  /**
   * Annotation `data-component` / `data-source`. Défaut : true, après 2000 ms —
   * injecter des attributs avant la fin de l'hydratation provoque
   * "tree hydrated but some attributes didn't match".
   */
  annotate?: boolean | { delayMs?: number };
  /** Filtre console dev. `true` = règles par défaut, ou liste de RegExp. Défaut : true. */
  hushConsole?: boolean | readonly RegExp[];
}

const DEFAULT_ANNOTATE_DELAY_MS = 2000;

// Accès littéraux : Next/webpack/Turbopack remplacent `process.env.X` à la build,
// y compris dans node_modules. Le try couvre les runtimes sans `process`.
function defaultEnabled(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

function defaultProjectRoot(): string | undefined {
  try {
    return process.env.NEXT_PUBLIC_PROJECT_ROOT;
  } catch {
    return undefined;
  }
}

/**
 * Point d'entrée à appeler dans `instrumentation-client.ts`.
 * Retourne une fonction qui démonte tout (listeners, observer, console).
 */
export function initRenderPicker(options: RenderPickerOptions = {}): () => void {
  const {
    enabled = defaultEnabled(),
    projectRoot = defaultProjectRoot(),
    clickToSource = true,
    annotate = true,
    hushConsole = true,
  } = options;

  if (!enabled || typeof window === "undefined") return () => {};

  const cleanups: (() => void)[] = [];

  // Marqueur lu par l'extension Chrome pour se désactiver (évite le double picker).
  document.documentElement.setAttribute(NPM_MARKER_ATTR, "npm");
  cleanups.push(() => document.documentElement.removeAttribute(NPM_MARKER_ATTR));

  // Capture console + network pour le panneau d'inspection.
  cleanups.push(startCapture());

  if (hushConsole) {
    cleanups.push(
      hushConsoleNoise(hushConsole === true ? DEFAULT_HUSH_RULES : hushConsole),
    );
  }

  // Enregistré immédiatement (avant tout effet React) pour être premier en
  // capture. Lit data-source au moment du clic → pas besoin d'attendre l'annotation.
  if (clickToSource) cleanups.push(initClickToSource(projectRoot));

  if (annotate) {
    const delayMs =
      typeof annotate === "object" && annotate.delayMs !== undefined
        ? annotate.delayMs
        : DEFAULT_ANNOTATE_DELAY_MS;
    let stopAnnotator: (() => void) | null = null;
    const timer = setTimeout(() => {
      stopAnnotator = initComponentAnnotator();
    }, delayMs);
    cleanups.push(() => {
      clearTimeout(timer);
      stopAnnotator?.();
    });
  }

  return () => {
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}

export { buildVscodeUri, initClickToSource } from "./core/dev/click-to-source";
export {
  annotate,
  annotateTree,
  componentInfo,
  initComponentAnnotator,
  type AnnotateResult,
} from "./core/source/component-annotate";
export { DEFAULT_HUSH_RULES, hushConsoleNoise } from "./core/dev/console-hush";
export { enrichResult, findPickedElement } from "./core/source/enrich";
export { createInspector } from "./core/inspector/inspector";
export { ACCENT } from "./core/inspector/constants/picker";
export {
  PANEL_BORDER,
  SOLID_BG,
  TOOLTIP_SHADOW,
} from "./core/inspector/constants/theme";
export { getCssSelector } from "./core/inspector/css-selector";
export { getXPath } from "./core/inspector/xpath";
export {
  normalizeSourcePath,
  resolvePosition,
} from "./core/source/source-map-resolver";
export {
  DEFAULT_SETTINGS,
  fetchSettings,
  loadSettings,
  saveSettings,
  type RenderPickerSettings,
} from "./core/settings";
export type {
  InspectorCallbacks,
  LayoutOverlays,
  PickResult,
  ResolvedPosition,
} from "./core/types";
