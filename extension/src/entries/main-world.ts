import { initComponentAnnotator } from "../../../src/core/source/component-annotate";

/**
 * Script injecté dans le **MAIN world** de la page (accès aux fibers React
 * `__reactFiber$…`). Annote le DOM avec `data-component` / `data-source` /
 * `data-owner-source` (résolus via les sourcemaps des chunks). Le content script
 * isolé lit ensuite ces **attributs DOM** (partagés entre les mondes).
 *
 * Délai : laisser l'hydratation finir avant de poser des attributs (sinon
 * "tree hydrated but some attributes didn't match").
 */
setTimeout(() => {
  try {
    initComponentAnnotator();
  } catch {
    // page sans React / sans sourcemaps dev → picker générique seulement
  }
}, 1500);
