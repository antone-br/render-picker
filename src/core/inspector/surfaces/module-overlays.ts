import { IGNORE_ATTR } from "../constants/behavior";
import { MODULE_OVERLAY_BG, MODULE_OVERLAY_BORDER, MODULE_OVERLAY_LABEL_BG } from "../constants/layout";
import { OVERLAY_Z } from "../constants/picker";
import { resolveAdminDir } from "../../dev/admin-config";
import { resolveProjectRoot } from "../../dev/project-root";
import {
  findModuleForElement,
  hookPositionsUrl,
  initModuleOverlayScan,
  moduleConfigUrl,
  moduleDirPath,
  moduleTreeMarkdown,
  scanModuleOverlays,
  type ModuleOverlayEntry,
} from "../../source/module-overlay";
import { assign } from "./dom";

export interface ModuleOverlayPaths {
  /** Nom technique du module (ex. `blockreassurance`). */
  name: string;
  /** Nom du hook qui a déclenché ce rendu (`displayFooter`…) — `null` si non résolu
   * (override `Hook.php` absent/pas encore installé, ou rendu hors `Hook::exec`). */
  hookName: string | null;
  /** `public_html\...\modules\<nom>` — ancré au dossier racine du site (lisible, portable). */
  relative: string | null;
  /** Chemin disque hôte complet (ex. `C:\Users\...\public_html\...\modules\<nom>`). */
  absolute: string | null;
  /** URL back-office "configurer ce module" — `null` si le dossier admin n'est pas exposé
   * (`window.renderPickerAdminDir`, voir `renderpicker.php`). */
  configUrl: string | null;
  /** URL back-office de la page "Positions" (tous les hooks) — `null` si `hookName` est
   * `null` (rien à relier) ou si le dossier admin n'est pas exposé. */
  hookPositionsUrl: string | null;
}

type ModuleOverlayContextMenuHandler = (
  el: Element,
  pos: { x: number; y: number },
  modulePath: ModuleOverlayPaths,
  /** Calcule à la demande le Markdown listant tous les modules de la page (arbre par
   * confinement géométrique) — pour "Copier l'arbre des modules", indépendant du module
   * cliqué. Paresseux : `buildModuleTree` est O(n²) sur le nombre de modules, pas la peine
   * de le payer à chaque clic droit si l'action n'est jamais utilisée. */
  getModulesTree: () => string,
) => void;

/** Clic droit dans un rectangle module — branché par la couche React (menu contextuel). */
let contextMenuHandler: ModuleOverlayContextMenuHandler | null = null;

/** Enregistre le callback ouvrant le menu contextuel (HTML/rendu/classes/XPath). */
export function setModuleOverlayContextMenuHandler(
  handler: ModuleOverlayContextMenuHandler | null,
): void {
  contextMenuHandler = handler;
}

/** Dossier du module pour "Copier le chemin du module" (relatif `public_html\...` + absolu
 * chemin disque hôte complet) — `null` si la racine projet n'est pas résolue (Ctrl+clic
 * désactivé dans ce cas aussi). */
export function resolveModulePaths(entry: ModuleOverlayEntry): ModuleOverlayPaths {
  const configUrl = moduleConfigUrl(window.location.origin, resolveAdminDir(window), entry.name);
  const hookPositions = entry.hookName
    ? hookPositionsUrl(window.location.origin, resolveAdminDir(window))
    : null;
  const root = resolveProjectRoot(window, document).root;
  if (!root) {
    return {
      name: entry.name,
      hookName: entry.hookName,
      relative: null,
      absolute: null,
      configUrl,
      hookPositionsUrl: hookPositions,
    };
  }
  const normalized = root.replace(/\\/g, "/");
  const rootDirName = normalized.split("/").filter(Boolean).pop();
  return {
    name: entry.name,
    hookName: entry.hookName,
    relative: rootDirName ? moduleDirPath(entry.source, entry.name, rootDirName) : null,
    absolute: moduleDirPath(entry.source, entry.name, normalized.replace(/\//g, "\\")),
    configUrl,
    hookPositionsUrl: hookPositions,
  };
}

/** Entrées du dernier scan de la couche overlay montée (`initModuleOverlaySurface`), ou
 * `null` si aucune couche n'est montée — partagées avec `resolveModuleContextFor` pour lui
 * éviter un rescan complet du document quand l'overlay tourne déjà. */
let mountedEntries: ModuleOverlayEntry[] | null = null;

/** Résout les infos "Modules" (nom/chemins/URL config + arbre complet de la page) pour un
 * élément quelconque — réutilise le scan de la couche overlay si montée (`mountedEntries`),
 * sinon scanne à la demande (`scanModuleOverlays`) : permet au menu contextuel du picker
 * **normal** (armé par double-Shift) d'afficher "Modules" même overlay désactivé. `null` si
 * l'élément n'appartient à aucun module détecté. */
export function resolveModuleContextFor(
  el: Element,
): { modulePath: ModuleOverlayPaths; getModulesTree: () => string } | null {
  const entries = mountedEntries ?? scanModuleOverlays(document.body);
  const entry = findModuleForElement(entries, el);
  if (!entry) return null;
  return {
    modulePath: resolveModulePaths(entry),
    getModulesTree: () => moduleTreeMarkdown(entries, window.location.pathname),
  };
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
    const nameWithHook = entry.hookName ? `${entry.name} (${entry.hookName})` : entry.name;
    label.textContent = `${nameWithHook} — ${entry.durationMs} ms`;
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
    if (target) {
      // Capturé ici (pas l'arrow ci-dessous qui ferme sur `current`) : un rescan entre le
      // clic droit et le clic sur "Copier l'arbre" ne doit pas changer les entrées utilisées.
      const entriesAtClick = current;
      contextMenuHandler?.(
        target,
        { x: e.clientX, y: e.clientY },
        resolveModulePaths(entry),
        () => moduleTreeMarkdown(entriesAtClick, window.location.pathname),
      );
    }
  };
  window.addEventListener("contextmenu", onContextMenu, true);

  const stopScan = initModuleOverlayScan((entries) => {
    console.warn(`[render-picker] module-overlay : ${entries.length} module(s) détecté(s)`);
    for (const entry of entries) {
      console.warn(`[render-picker] module ${entry.name} — ${entry.durationMs} ms — ${entry.source}`);
    }
    current = entries;
    mountedEntries = entries;
    render(layer, entries);
  });

  return () => {
    console.warn("[render-picker] module-overlay : démontage de la couche");
    window.removeEventListener("contextmenu", onContextMenu, true);
    stopScan();
    layer.remove();
    mountedEntries = null;
  };
}
