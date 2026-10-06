import { initComponentAnnotator } from "../../../src/core/source/component-annotate";
import { initConsoleCapture } from "../../../src/core/devpanel/console-capture";
import { initNetworkCapture } from "../../../src/core/devpanel/network-capture";

/**
 * Script injecté dans le **MAIN world** de la page (accès aux fibers React +
 * aux vrais `console`/`fetch` de la page). Annote le DOM (`data-*`) et capture
 * console + network, streamés au content script (monde isolé) via `postMessage`.
 */

const SOURCE = "render-picker-devpanel";

initConsoleCapture((entry) => {
  window.postMessage({ source: SOURCE, kind: "log", entry }, "*");
});
initNetworkCapture((entry) => {
  window.postMessage({ source: SOURCE, kind: "net", entry }, "*");
});

// Annotation fibers : laisser l'hydratation finir avant de poser des attributs.
setTimeout(() => {
  try {
    initComponentAnnotator();
  } catch {
    // page sans React / sans sourcemaps dev → picker générique seulement
  }
}, 1500);
