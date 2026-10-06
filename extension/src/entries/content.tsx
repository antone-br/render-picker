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
  if (npmActive()) return; // package npm déjà présent → extension inactive
  // Idempotent : auto-chargé (match) + injecté à la demande (icône) → un seul montage.
  if ((window as unknown as Record<string, boolean>)[FLAG]) return;
  (window as unknown as Record<string, boolean>)[FLAG] = true;

  injectMainWorld();

  // Relais des captures console/network (MAIN world → store du monde isolé).
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.source !== "render-picker-devpanel") return;
    if (d.kind === "log") addLog(d.entry);
    else if (d.kind === "net") addRequest(d.entry);
  });

  await initStorage();

  let toggle: (() => void) | null = null;
  const { root, host } = mountUi((fn) => {
    toggle = fn;
  });

  // Course : si le package npm s'initialise après nous (ex. bouton monté après
  // l'hydratation), se démonter proprement dès que le marqueur apparaît.
  const observer = new MutationObserver(() => {
    if (!npmActive()) return;
    observer.disconnect();
    root.unmount();
    host.remove();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [NPM_MARKER_ATTR],
  });

  // Clic sur l'icône de la barre d'outils → toggle du picker.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "render-picker:toggle") toggle?.();
  });
}

void main().catch(() => {});
