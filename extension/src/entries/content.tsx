import { createRoot, type Root } from "react-dom/client";

import { NPM_MARKER_ATTR } from "../../../src/core/inspector/constants/behavior";
import { addLog, addRequest } from "../../../src/core/devpanel/store";
import { initStorage } from "../storage";
import { ExtensionRoot } from "../ui/root";

/**
 * Content script (monde ISOLÉ). Si l'app utilise déjà le package npm render-picker
 * (marqueur `data-render-picker` sur `<html>`), l'extension reste inactive. Sinon :
 * injecte le script MAIN world (annotation fibers), initialise le stockage, monte
 * l'UI React dans un shadow root.
 */

/** Injecte `main-world.js` dans le MAIN world pour accéder aux fibers React. */
function injectMainWorld(): void {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("main-world.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

/** Monte l'UI dans un shadow root (isole du CSS de la page). Retourne root + host. */
function mountUi(onReady: (toggle: () => void) => void): { root: Root; host: HTMLElement } {
  const host = document.createElement("div");
  host.setAttribute("data-pathpicker-ignore", "");
  host.style.cssText = "all: initial; position: static;";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const mount = document.createElement("div");
  shadow.appendChild(mount);
  const root = createRoot(mount);
  root.render(<ExtensionRoot onReady={onReady} />);
  return { root, host };
}

const FLAG = "__renderPickerLoaded__";

/** Vrai si le package npm render-picker est actif sur la page. */
function npmActive(): boolean {
  return document.documentElement.hasAttribute(NPM_MARKER_ATTR);
}

async function main(): Promise<void> {
  if (window.top !== window) return; // pas dans les iframes
  // Idempotent : auto-chargé (match) + injecté à la demande (icône) → un seul montage.
  if ((window as unknown as Record<string, boolean>)[FLAG]) return;
  (window as unknown as Record<string, boolean>)[FLAG] = true;

  let mounted: { root: Root; host: HTMLElement } | null = null;
  let disposed = false;

  const teardown = (): void => {
    disposed = true;
    if (mounted) {
      mounted.root.unmount();
      mounted.host.remove();
      mounted = null;
    }
  };

  // Observer AVANT tout → aucune fenêtre de course : si le package npm pose le
  // marqueur à n'importe quel moment (y compris pendant nos `await`), on se retire.
  // Couvre le cas `client:only` / hydratation tardive (Astro, Next RSC, etc.).
  const observer = new MutationObserver(() => {
    if (npmActive()) {
      observer.disconnect();
      teardown();
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [NPM_MARKER_ATTR],
  });

  if (npmActive()) {
    observer.disconnect();
    return; // package npm déjà présent → extension inactive
  }

  // Relais des captures console/network (MAIN world → store du monde isolé).
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.source !== "render-picker-devpanel") return;
    if (d.kind === "log") addLog(d.entry);
    else if (d.kind === "net") addRequest(d.entry);
  });

  await initStorage();
  // Marqueur apparu pendant l'`await` (avant que `mounted` existe) → ne pas monter.
  if (disposed || npmActive()) {
    observer.disconnect();
    return;
  }

  injectMainWorld();

  let toggle: (() => void) | null = null;
  mounted = mountUi((fn) => {
    toggle = fn;
  });

  // Dernière vérif : marqueur posé pendant le mount → démonter aussitôt.
  if (npmActive()) {
    observer.disconnect();
    teardown();
    return;
  }

  // Clic sur l'icône de la barre d'outils → toggle du picker.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "render-picker:toggle") toggle?.();
  });
}

void main().catch(() => {});
