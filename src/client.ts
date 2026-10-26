import { startCapture } from "./core/devpanel/capture";
import { NPM_MARKER_ATTR } from "./core/inspector/constants/behavior";
import { initClickToSource } from "./core/dev/click-to-source";
import { initComponentAnnotator } from "./core/source/component-annotate";
import { initTplAnnotator } from "./core/source/tpl-annotate";
import { DEFAULT_HUSH_RULES, hushConsoleNoise } from "./core/dev/console-hush";
import { initSettingsRefresh } from "./core/settings";

export interface RenderPickerOptions {
  /** Active l'outillage. Défaut : `process.env.NODE_ENV !== "production"`. */
  enabled?: boolean;
  /**
   * Racine absolue du projet. Défaut : `process.env.NEXT_PUBLIC_PROJECT_ROOT`,
   * sinon le contenu de `<meta name="render-picker-root">` (pages sans bundler,
   * ex. PrestaShop).
   */
  projectRoot?: string | null;
  /**
   * Source de la résolution `data-source` :
   * - `"react"` (défaut) : fibers React (`initComponentAnnotator`, sourcemaps) ;
   * - `"prestashop"` : commentaires Smarty `rp@file:line` (`initTplAnnotator`,
   *   sans attente d'hydratation).
   */
  source?: "react" | "prestashop";
  /** Alt+clic → VS Code. Défaut : true. */
  clickToSource?: boolean;
  /**
   * Annotation `data-component` / `data-source`. Défaut : true, après 2000 ms —
   * injecter des attributs avant la fin de l'hydratation provoque
   * "tree hydrated but some attributes didn't match". Ignoré si `source: "prestashop"`
   * (annotation immédiate, pas d'hydratation React).
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
    if (process.env.NEXT_PUBLIC_PROJECT_ROOT) return process.env.NEXT_PUBLIC_PROJECT_ROOT;
  } catch {
    // pas de `process` (navigateur sans bundler) → repli sur le <meta>
  }
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="render-picker-root"]');
    return meta?.getAttribute("content") ?? undefined;
  }
  return undefined;
}

/**
 * Point d'entrée à appeler dans `instrumentation-client.ts`.
 * Retourne une fonction qui démonte tout (listeners, observer, console).
 */
export function initRenderPicker(options: RenderPickerOptions = {}): () => void {
  const {
    enabled = defaultEnabled(),
    projectRoot = defaultProjectRoot(),
    source = "react",
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

  // Config.json relu sur le disque (route dev) au focus — remap à chaud.
  cleanups.push(initSettingsRefresh());

  if (hushConsole) {
    cleanups.push(
      hushConsoleNoise(hushConsole === true ? DEFAULT_HUSH_RULES : hushConsole),
    );
  }

  // Enregistré immédiatement (avant tout effet React) pour être premier en
  // capture. Lit data-source au moment du clic → pas besoin d'attendre l'annotation.
  if (clickToSource) cleanups.push(initClickToSource(projectRoot));

  if (annotate) {
    if (source === "prestashop") {
      // Commentaires Smarty déjà dans le HTML serveur → annotation immédiate,
      // pas d'hydratation React à attendre.
      cleanups.push(initTplAnnotator());
    } else {
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
  }

  return () => {
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}

export { buildVscodeUri, initClickToSource } from "./core/dev/click-to-source";
export { buildEditorUri, EDITORS, type EditorId, type EditorInfo } from "./core/dev/editors";
export {
  pickResultFromElement,
  searchElements,
  toSelector,
} from "./core/search/element-search";
export {
  annotate,
  annotateTree,
  componentInfo,
  initComponentAnnotator,
  type AnnotateResult,
} from "./core/source/component-annotate";
export {
  annotateFromComments,
  initTplAnnotator,
  parseTplMarker,
} from "./core/source/tpl-annotate";
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
  initSettingsRefresh,
  loadSettings,
  refreshSettings,
  saveSettings,
  settingsDelta,
  type RenderPickerSettings,
} from "./core/settings";
export type {
  InspectorCallbacks,
  LayoutOverlays,
  PickResult,
  ResolvedPosition,
} from "./core/types";
