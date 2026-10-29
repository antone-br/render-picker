/**
 * Overlay permanent "modules PrestaShop" — scan des marqueurs dynamiques
 * `<!-- rp-module:nom:hookName:duréeMs:relpath:ligne --> … <!-- /rp-module -->` injectés
 * par l'override `Module::fetch()` (voir `integrations/prestashop/renderpicker/`).
 * Contrairement aux marqueurs `rp@` (statiques, gravés au compile), ceux-ci sont
 * dynamiques (durée qui varie à chaque requête) et encadrent le HTML complet d'un
 * module racine. Sans React, testable sans DOM réel via jsdom.
 */

import { moduleNameFromSource, parseTplMarker } from "./tpl-annotate";

export interface ModuleOverlayEntry {
  name: string;
  /** Nom du hook qui a déclenché ce rendu (`displayFooter`…) — `null` si le rendu n'est
   * pas passé par `Hook::exec()` (override `Hook.php` absent/pas encore installé, ou
   * appel direct `->fetch()` hors hook). */
  hookName: string | null;
  durationMs: number;
  /** `relpath:ligne` — réutilisable tel quel comme `data-source`. */
  source: string;
  rect: { left: number; top: number; width: number; height: number };
  /** Éléments de premier niveau propres au module (hors sous-arbres d'un autre module
   * inclus en Smarty inline) — cible du menu contextuel (copier HTML/rendu/…), pas
   * l'élément exact sous le curseur (souvent un simple `<p>`/`<span>` interne). */
  elements: Element[];
}

const START_RE = /^rp-module:([^:]+):([^:]*):([\d.]+):(.+)$/;

/** `rp-module:Nom:hookName:12.4:themes/x/foo.tpl:3` → `{ name, hookName, durationMs,
 * source }` (`hookName` vide dans le marqueur → `null`). Pur. */
export function parseModuleStart(
  text: string,
): { name: string; hookName: string | null; durationMs: number; source: string } | null {
  const m = START_RE.exec(text.trim());
  if (!m) return null;
  return { name: m[1]!, hookName: m[2] ? m[2] : null, durationMs: Number(m[3]), source: m[4]! };
}

/** Vrai si le commentaire ferme un bloc `rp-module`. Pur. */
export function isModuleEnd(text: string): boolean {
  return text.trim() === "/rp-module";
}

/**
 * Chemin Windows du dossier du module à partir de `source` ("relpath:ligne") et du nom
 * du module — tronque au dernier segment `modules/<moduleName>` (inclus), ignore tout ce
 * qui suit (sous-dossier .tpl). `rootDirName` = dernier segment de la racine projet
 * (ex. "public_html", basename de `resolveProjectRoot(...).root`) — pas codé en dur ici,
 * pur/testable sans DOM.
 */
export function moduleDirPath(
  source: string,
  moduleName: string,
  rootDirName: string,
): string | null {
  const rel = source.replace(/:\d+$/, "");
  const marker = `modules/${moduleName}`;
  const idx = rel.indexOf(marker);
  if (idx === -1) return null;
  const relDir = rel.slice(0, idx + marker.length);
  return `${rootDirName}\\${relDir.replace(/\//g, "\\")}`;
}

/** URL back-office "configurer ce module" (AdminModules) — pur, pas de dépendance DOM à
 * part les valeurs déjà résolues (origin/adminDir) passées en paramètres. Pas de token :
 * calculé en contexte front il ne peut de toute façon pas matcher la session admin réelle
 * (voir `renderpicker.php`) — PrestaShop affiche le même interstitiel "continuer" avec ou
 * sans, pas la peine de le porter jusqu'ici. */
export function moduleConfigUrl(
  origin: string,
  adminDir: string | undefined,
  moduleName: string,
): string | null {
  if (!adminDir) return null;
  const params = new URLSearchParams({ controller: "AdminModules", configure: moduleName });
  return `${origin.replace(/\/$/, "")}/${adminDir}/index.php?${params.toString()}`;
}

/** URL back-office de la page "Positions" (`AdminModulesPositions`) — liste tous les
 * hooks du site, pas de deep-link fiable vers un hook précis (pas de paramètre
 * standard, et ça diffère selon le thème admin) : on lie la page générale, le nom du
 * hook est copiable séparément pour la recherche manuelle dessus. Pur, même raisonnement
 * sans token que `moduleConfigUrl`. */
export function hookPositionsUrl(origin: string, adminDir: string | undefined): string | null {
  if (!adminDir) return null;
  const params = new URLSearchParams({ controller: "AdminModulesPositions" });
  return `${origin.replace(/\/$/, "")}/${adminDir}/index.php?${params.toString()}`;
}

export interface ModuleTreeNode {
  name: string;
  children: ModuleTreeNode[];
}

function rectArea(r: ModuleOverlayEntry["rect"]): number {
  return r.width * r.height;
}

function rectContains(outer: ModuleOverlayEntry["rect"], inner: ModuleOverlayEntry["rect"]): boolean {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.left + outer.width >= inner.left + inner.width &&
    outer.top + outer.height >= inner.top + inner.height
  );
}

/**
 * Arbre de nesting des modules d'après le confinement géométrique de leurs rectangles —
 * les marqueurs `rp-module` n'exposent aucune hiérarchie DOM, seulement une liste plate en
 * ordre document. Un module est "enfant" du plus petit autre module dont le rectangle le
 * contient entièrement (confinement le plus serré = parent direct, pas le plus englobant).
 * Pur ; ordre des enfants = ordre document (ordre de `entries`, déjà celui du scan).
 */
export function buildModuleTree(entries: ModuleOverlayEntry[]): ModuleTreeNode[] {
  const nodes = entries.map((entry) => ({ entry, node: { name: entry.name, children: [] as ModuleTreeNode[] } }));
  const roots: ModuleTreeNode[] = [];
  for (const { entry, node } of nodes) {
    let parent: (typeof nodes)[number] | null = null;
    for (const candidate of nodes) {
      if (candidate.entry === entry) continue;
      if (!rectContains(candidate.entry.rect, entry.rect)) continue;
      if (rectArea(candidate.entry.rect) <= rectArea(entry.rect)) continue;
      if (!parent || rectArea(candidate.entry.rect) < rectArea(parent.entry.rect)) parent = candidate;
    }
    if (parent) parent.node.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Rendu Markdown de l'arbre des modules (liste à puces, 2 espaces d'indentation par
 * niveau) — à coller dans un `.md` pour documenter visuellement la structure modules
 * d'une page. Voir `.claude/.docs/architecture.md` pour la convention. Pur. */
export function moduleTreeMarkdown(entries: ModuleOverlayEntry[], route: string): string {
  const lines: string[] = [`# Modules — ${route}`, ""];
  const tree = buildModuleTree(entries);
  if (tree.length === 0) {
    lines.push("_(aucun module détecté)_");
  } else {
    const walk = (nodes: ModuleTreeNode[], depth: number) => {
      for (const n of nodes) {
        lines.push(`${"  ".repeat(depth)}- ${n.name}`);
        walk(n.children, depth + 1);
      }
    };
    walk(tree, 0);
  }
  return lines.join("\n");
}

/**
 * Vrai si le marqueur `rp@` **immédiatement précédent** de `el` en ordre document (celui
 * qui déterminerait son `data-source` dans `tpl-annotate.ts`) résout à un module différent
 * de `ownName` — signe que `el` est lui-même un frère inséré par un autre module (ex.
 * `{hook h='…'}` Smarty inline rendant un bloc entier à côté du contenu propre). Ne regarde
 * QUE le marqueur propre à `el`, pas son sous-arbre entier : un module qui inclut juste un
 * lien d'un autre module *au milieu* de son propre contenu (le marqueur étranger est alors
 * imbriqué plus profondément, pas immédiatement précédent) reste considéré comme propre —
 * sinon tout son rectangle disparaîtrait pour un détail mineur.
 */
function isForeignModule(el: Element, ownName: string): boolean {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  walker.currentNode = el;
  let node: Node | null = walker.previousNode();
  while (node) {
    const marker = parseTplMarker((node as Comment).data);
    if (marker) {
      const mod = moduleNameFromSource(marker.source);
      return mod !== null && mod !== ownName;
    }
    node = walker.previousNode();
  }
  return false;
}

/**
 * Rectangle englobant (coordonnées **viewport**, pas document) d'une liste d'éléments.
 * Viewport plutôt que document+scroll : certains modules (barre sticky `position:fixed`)
 * ne bougent pas au scroll — un rectangle en coordonnées document s'en détacherait. Le
 * rendu (`module-overlays.ts`) utilise `position:fixed` et recalcule au scroll.
 */
function unionRect(elements: Element[]): ModuleOverlayEntry["rect"] | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    // Largeur OU hauteur nulle = aucune zone visible (ex. placeholder vide d'une
    // variante WOW.js inutilisée) — ne doit pas tirer le rectangle vers lui.
    if (r.width === 0 || r.height === 0) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(left)) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Remonte tant que le parent n'a **que** `el` comme enfant élément (ex. un `<div>` du
 * thème qui n'enveloppe rien d'autre que l'appel au hook du module — cas
 * `#contact_info_sag` autour de `ps_contactinfo`). Le rectangle colle alors au conteneur
 * visuel réel plutôt qu'à la seule racine stricte du module. Sûr : un parent qui a
 * plusieurs enfants (cas `tvcmscustomsetting`, plusieurs frères dont certains d'un autre
 * module) arrête immédiatement la remontée — aucun risque d'engloutir un frère étranger.
 */
function climbExclusiveWrapper(el: Element): Element {
  let current = el;
  for (;;) {
    const parent = current.parentElement;
    if (!parent || parent === document.body || parent.children.length !== 1) break;
    current = parent;
  }
  return current;
}

/**
 * Parcourt `root` (ordre document) à la recherche des paires `rp-module`/`/rp-module`
 * et retourne une entrée par module racine trouvé (rectangle englobant des éléments
 * encadrés). Les paires imbriquées ne devraient pas exister (l'override PHP ne wrappe
 * qu'à profondeur 0) ; si elles apparaissent quand même, elles sont traitées comme des
 * entrées indépendantes plutôt que de planter.
 */
export function scanModuleOverlays(root: Node = document.body): ModuleOverlayEntry[] {
  const entries: ModuleOverlayEntry[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const start = parseModuleStart((node as Comment).data);
    if (start) {
      const elements: Element[] = [];
      let sib: Node | null = node.nextSibling;
      while (sib && !(sib.nodeType === Node.COMMENT_NODE && isModuleEnd((sib as Comment).data))) {
        if (sib.nodeType === Node.ELEMENT_NODE) elements.push(sib as Element);
        sib = sib.nextSibling;
      }
      const owned = elements.filter((el) => !isForeignModule(el, start.name)).map(climbExclusiveWrapper);
      const rect = unionRect(owned);
      if (rect) {
        entries.push({
          name: start.name,
          hookName: start.hookName,
          durationMs: start.durationMs,
          source: start.source,
          rect,
          elements: owned,
        });
      }
    }
    node = walker.nextNode();
  }
  return entries;
}

/** Retrouve l'entrée module (parmi `entries`, déjà scannées) dont `el` fait partie —
 * élément racine propre du module, ou un de ses descendants. `null` si `el` n'appartient
 * à aucun module scanné (page sans marqueur `rp-module`, ou élément hors de tout module). */
export function findModuleForElement(
  entries: ModuleOverlayEntry[],
  el: Element,
): ModuleOverlayEntry | null {
  return entries.find((e) => e.elements.some((top) => top === el || top.contains(el))) ?? null;
}

/** Délais (ms) des rescans différés après montage — rattrape les animations d'entrée
 * (WOW.js `slideInRight`…) qui déplacent un élément après le premier scan. */
const SETTLE_DELAYS_MS = [400, 1200];

/** Délai (ms) du rescan différé après un clic — laisse le temps à une transition CSS
 * (accordéon Bootstrap `collapse`…) déclenchée par ce clic de se terminer. */
const CLICK_SETTLE_DELAY_MS = 400;

/**
 * Scan au montage (immédiat + différé pour rattraper les animations d'entrée), puis à
 * chaque scroll/resize/clic (rAF-throttlé — coordonnées viewport, les modules
 * `position:fixed` ne bougent pas au scroll mais les autres si). `click` : un clic est un
 * événement **discret**, borné par l'utilisateur (contrairement à `class`/`style` observés
 * en continu via `MutationObserver` — jeté : un carousel auto-play, ex. owl-carousel, anime
 * son `style` **en boucle sans jamais s'arrêter**, ce qui rescannait/relogait à l'infini) —
 * couvre les accordéons Bootstrap (`data-toggle="collapse"`) qui changent la taille d'un
 * module sans ajout de nœud ; un rescan différé (`CLICK_SETTLE_DELAY_MS`) rattrape la taille
 * finale une fois la transition CSS terminée. Retourne une fonction d'arrêt.
 */
export function initModuleOverlayScan(onChange: (entries: ModuleOverlayEntry[]) => void): () => void {
  let frame: number | null = null;
  const rescan = () => {
    frame = null;
    onChange(scanModuleOverlays());
  };
  const schedule = () => {
    if (frame === null) frame = requestAnimationFrame(rescan);
  };

  const timers: ReturnType<typeof setTimeout>[] = SETTLE_DELAYS_MS.map((ms) => setTimeout(schedule, ms));
  const onClick = () => {
    schedule();
    timers.push(setTimeout(schedule, CLICK_SETTLE_DELAY_MS));
  };

  schedule();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("click", onClick, true);

  return () => {
    for (const t of timers) clearTimeout(t);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("click", onClick, true);
    if (frame !== null) cancelAnimationFrame(frame);
  };
}
