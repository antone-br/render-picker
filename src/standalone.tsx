import { createRoot, type Root } from "react-dom/client";

import { initClickToSource } from "./core/dev/click-to-source";
import { resolveProjectRoot } from "./core/dev/project-root";
import { IGNORE_ATTR } from "./core/inspector/constants/behavior";
import { initTplAnnotator } from "./core/source/tpl-annotate";
import { RenderPickerButton } from "./react";

/**
 * Entrée du build **global** (`<script>`, React bundlé) pour les pages sans bundler
 * JS — typiquement PrestaShop (Smarty). Monte l'UI render-picker dans un shadow root,
 * puis branche l'ouverture éditeur (`initClickToSource`) et l'annotateur Smarty
 * (`initTplAnnotator`, qui lit les commentaires `rp@file:line`). `RenderPickerButton`
 * pose déjà le marqueur npm + la capture console/réseau — on ne rappelle pas
 * `initRenderPicker` (évite un double montage). Expose `window.RenderPicker.init`.
 */

export interface StandaloneOptions {
  /**
   * Racine absolue du projet (pour construire l'URI éditeur). Défaut : contenu de
   * `<meta name="render-picker-root">`.
   */
  projectRoot?: string | null;
  /** Raccourci d'armement. Défaut : réglage `commands.arm` (Shift Shift). */
  hotkey?: string | string[] | false;
}

let mounted = false;

/** Monte render-picker sur la page courante. Retourne une fonction de démontage. */
export function init(options: StandaloneOptions = {}): () => void {
  if (typeof window === "undefined" || mounted) return () => {};
  mounted = true;

  const projectRoot = options.projectRoot ?? resolveProjectRoot(window, document).root;

  const host = document.createElement("div");
  host.setAttribute(IGNORE_ATTR, "");
  host.style.cssText = "all: initial; position: static;";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const mount = document.createElement("div");
  shadow.appendChild(mount);
  const root: Root = createRoot(mount);
  root.render(<RenderPickerButton hotkey={options.hotkey} />);

  // Pas de serveur Node sur une page PrestaShop → on va direct au lien vscode://
  // (pas de POST /api/render-picker → pas de 404).
  const stopClick = initClickToSource(projectRoot, undefined, false);
  const stopAnnotator = initTplAnnotator();

  return () => {
    stopAnnotator();
    stopClick();
    root.unmount();
    host.remove();
    mounted = false;
  };
}

// Exposition globale pour un chargement par simple <script> (sans import/bundler).
(window as unknown as { RenderPicker?: { init: typeof init } }).RenderPicker = { init };

// Auto-init : chargé par le module PrestaShop en fin de page (`registerJavascript`
// position bottom), la racine projet vient de `window.renderPickerRoot` (`addJsDef`).
// Le garde `mounted` évite un double montage si `init()` est aussi appelé à la main.
function autoInit(): void {
  init();
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }
}
