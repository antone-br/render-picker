import { IGNORE_ATTR } from "../constants/behavior";
import { MODULE_OVERLAY_BG, MODULE_OVERLAY_BORDER, MODULE_OVERLAY_LABEL_BG } from "../constants/layout";
import { OVERLAY_Z } from "../constants/picker";
import { initModuleOverlayScan, type ModuleOverlayEntry } from "../../source/module-overlay";
import { assign } from "./dom";

/** Clic droit dans un rectangle module — branché par la couche React (menu contextuel). */
let contextMenuHandler: ((el: Element, pos: { x: number; y: number }) => void) | null = null;

/** Enregistre le callback ouvrant le menu contextuel (HTML/rendu/classes/XPath). */
export function setModuleOverlayContextMenuHandler(
  handler: ((el: Element, pos: { x: number; y: number }) => void) | null,
): void {
  contextMenuHandler = handler;
}

/** Dessine un rectangle (+ label nom/durée) par entrée, `data-source` posé pour Ctrl+clic.
 * `pointer-events:none` : le rectangle ne doit jamais bloquer les clics/sélections du site
 * réel sous lui (ex. champ de recherche) — les clics "traversent" jusqu'à l'élément réel. */
function render(layer: HTMLElement, entries: ModuleOverlayEntry[]): void {
  layer.textContent = "";
  for (const entry of entries) {
    const box = document.createElement("div");
    box.setAttribute("data-source", entry.source);
    assign(box, {
      position: "fixed",
      left: `${entry.rect.left}px`,
      top: `${entry.rect.top}px`,
      width: `${entry.rect.width}px`,
      height: `${entry.rect.height}px`,
      border: MODULE_OVERLAY_BORDER,
      background: MODULE_OVERLAY_BG,
      boxSizing: "border-box",
      pointerEvents: "none",
    });

    const label = document.createElement("span");
    label.textContent = `${entry.name} — ${entry.durationMs} ms`;
    assign(label, {
      position: "absolute",
      top: "-18px",
      left: "0",
      padding: "1px 5px",
      borderRadius: "4px",
      font: "600 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
      color: "#fff",
      background: MODULE_OVERLAY_LABEL_BG,
      whiteSpace: "nowrap",
      pointerEvents: "none",
    });
    box.appendChild(label);
    layer.appendChild(box);
  }
}

/** Vrai si `(x, y)` tombe dans le rectangle de `entry` (coordonnées viewport). */
function hitTest(entry: ModuleOverlayEntry, x: number, y: number): boolean {
  const { left, top, width, height } = entry.rect;
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

/**
 * Monte la couche de rectangles permanents "modules PrestaShop" (toggle paramètres,
 * indépendant de l'armement du picker) : scan des marqueurs `rp-module` via
 * `initModuleOverlayScan`, dessin des rectangles — `pointer-events:none`, ils ne gênent
 * jamais l'usage normal du site (clic, sélection de texte…) sous eux.
 *
 * Ctrl+clic ouvre l'éditeur via le `data-source` déjà posé sur le vrai contenu par
 * `initTplAnnotator` (réutilise `initClickToSource`, déjà actif globalement, pas de logique
 * de clic dédiée). Clic droit : un listener global (capture) teste si le point cliqué tombe
 * dans un rectangle connu (`hitTest`) ; si oui, avale le menu natif du navigateur et
 * transmet le **premier élément propre du module** (`entry.elements[0]`, pas
 * `elementFromPoint` — sinon on cible le `<p>`/`<span>` exact sous le curseur au lieu du
 * bloc représentatif du module, ex. `<p>Rechercher</p>` au lieu du `<form>` entier) à
 * `setModuleOverlayContextMenuHandler` (branché par `RenderPickerButton` sur le même menu
 * contextuel HTML/rendu/classes/XPath que le picker normal). Retourne une fonction de
 * démontage.
 */
export function initModuleOverlaySurface(): () => void {
  console.warn("[render-picker] module-overlay : montage de la couche");
  const layer = document.createElement("div");
  layer.setAttribute(IGNORE_ATTR, "");
  assign(layer, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "0",
    height: "0",
    overflow: "visible",
    zIndex: String(OVERLAY_Z),
  });
  document.body.appendChild(layer);

  let current: ModuleOverlayEntry[] = [];
  const onContextMenu = (e: MouseEvent) => {
    const entry = current.find((en) => hitTest(en, e.clientX, e.clientY));
    if (!entry) return;
    e.preventDefault();
    const target = entry.elements[0];
    if (target) contextMenuHandler?.(target, { x: e.clientX, y: e.clientY });
  };
  window.addEventListener("contextmenu", onContextMenu, true);

  const stopScan = initModuleOverlayScan((entries) => {
    console.warn(`[render-picker] module-overlay : ${entries.length} module(s) détecté(s)`);
    for (const entry of entries) {
      console.warn(`[render-picker] module ${entry.name} — ${entry.durationMs} ms — ${entry.source}`);
    }
    current = entries;
    render(layer, entries);
  });

  return () => {
    console.warn("[render-picker] module-overlay : démontage de la couche");
    window.removeEventListener("contextmenu", onContextMenu, true);
    stopScan();
    layer.remove();
  };
}
