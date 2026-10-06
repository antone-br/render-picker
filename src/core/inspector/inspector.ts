import {
  DEFAULT_SETTINGS,
  gestureMatches,
  keyMatches,
  type ClickTrigger,
} from "../settings";
import type { InspectorCallbacks, PickResult } from "../types";
import { DOWN_TYPE, IGNORE_ATTR, PRESS_EVENTS, SWALLOW_MS } from "./constants/behavior";
import { PICKING_CSS } from "./constants/picker";
import { getCssSelector } from "./css-selector";
import { containsPoint, resolveTarget, shouldIgnore } from "./hit-test";
import { createSurfaces, type Surfaces } from "./surfaces/create";
import { clearDecorations, renderDecorations } from "./surfaces/decorations";
import { renderMarkers } from "./surfaces/markers";
import { hideHover, positionOverlay } from "./surfaces/overlay";
import { updateTooltip } from "./surfaces/tooltip";
import { getXPath } from "./xpath";

/**
 * Inspecteur DOM impératif, sans React. Survol → overlay + tooltip ; clic →
 * pick ; Maj+clic → accumulation ; Entrée → confirme ; Échap → annule. Produit
 * un `PickResult` partiel (route/xpath/css/tagName/id) — l'enrichissement React
 * (`reactComponent`/`reactSource`) se fait côté appelant via `enrichResult`.
 *
 * `activate()` installe tout, `deactivate()` démonte tout (règle : tout init a
 * son cleanup). No-op en SSR. Orchestration uniquement : le hit-test vit dans
 * `hit-test.ts`, les surfaces DOM dans `surfaces/`.
 */
class Inspector {
  private active = false;
  private styleEl: HTMLStyleElement | null = null;
  private surfaces: Surfaces | null = null;
  private lastTarget: Element | null = null;
  private selection: Element[] = [];
  private observer: ResizeObserver | null = null;
  private hovering = false;

  constructor(private readonly callbacks: InspectorCallbacks) {}

  private get multi(): boolean {
    return (
      this.callbacks.multi !== false &&
      typeof this.callbacks.onPickMany === "function"
    );
  }

  activate(): void {
    if (this.active || typeof document === "undefined") return;
    this.active = true;

    this.styleEl = document.createElement("style");
    this.styleEl.setAttribute(IGNORE_ATTR, "");
    this.styleEl.textContent = PICKING_CSS;
    document.head.appendChild(this.styleEl);

    this.surfaces = createSurfaces();
    document.body.appendChild(this.surfaces.container);
    document.body.style.cursor = "crosshair";

    window.addEventListener("mousemove", this.onMouseMove, true);
    for (const type of PRESS_EVENTS) {
      window.addEventListener(type, this.onPress, true);
    }
    window.addEventListener("keydown", this.onKeyDown, true);
    window.addEventListener("scroll", this.refreshAll, true);
    window.addEventListener("resize", this.refreshAll);
    window.addEventListener("transitionend", this.refreshAll, true);
    window.addEventListener("animationend", this.refreshAll, true);

    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.refreshAll());
    }
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    this.lastTarget = null;
    this.selection = [];
    if (typeof document !== "undefined") document.body.style.cursor = "";

    window.removeEventListener("mousemove", this.onMouseMove, true);
    for (const type of PRESS_EVENTS) {
      window.removeEventListener(type, this.onPress, true);
    }
    window.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("scroll", this.refreshAll, true);
    window.removeEventListener("resize", this.refreshAll);
    window.removeEventListener("transitionend", this.refreshAll, true);
    window.removeEventListener("animationend", this.refreshAll, true);

    this.observer?.disconnect();
    this.observer = null;
    this.styleEl?.remove();
    this.surfaces?.container.remove();
    this.styleEl = null;
    this.surfaces = null;
  }

  // --- Rendu (délègue à surfaces) ------------------------------------------

  private hideHover(): void {
    this.hovering = false;
    if (!this.surfaces) return;
    hideHover(this.surfaces.overlay, this.surfaces.tooltip);
    clearDecorations(this.surfaces.decorLayer);
  }

  private showHover(el: Element, rect: DOMRect, animate = true): void {
    if (!this.surfaces) return;
    positionOverlay(this.surfaces.overlay, rect, animate);
    updateTooltip(
      this.surfaces.tooltip,
      this.surfaces.tooltipLabel,
      this.surfaces.tooltipDivider,
      this.surfaces.tooltipMetrics,
      this.surfaces.dims,
      el,
      this.selection,
      rect,
      this.callbacks.getTitle,
    );
    this.renderDecor(el, rect);
    this.hovering = true;
  }

  /** Dessine (ou efface) les décorations layout selon `getOverlays`. */
  private renderDecor(el: Element, rect: DOMRect): void {
    if (!this.surfaces) return;
    const overlays = this.callbacks.getOverlays?.();
    if (overlays && (overlays.padding || overlays.gap || overlays.margin)) {
      renderDecorations(this.surfaces.decorLayer, el, rect, overlays);
    } else {
      clearDecorations(this.surfaces.decorLayer);
    }
  }

  /** Re-render des décorations sur l'élément survolé (toggle sans mousemove). */
  refreshDecorations(): void {
    if (!this.active || !this.surfaces) return;
    if (this.lastTarget && this.lastTarget.isConnected) {
      this.renderDecor(this.lastTarget, this.lastTarget.getBoundingClientRect());
    } else {
      clearDecorations(this.surfaces.decorLayer);
    }
  }

  private renderSelection(): void {
    if (this.surfaces) renderMarkers(this.surfaces.markerLayer, this.selection);
  }

  private pickTargetAt(x: number, y: number): Element | null {
    if (
      this.lastTarget &&
      this.lastTarget.isConnected &&
      containsPoint(this.lastTarget, x, y)
    ) {
      return this.lastTarget;
    }
    return resolveTarget(x, y);
  }

  private syncObserver(): void {
    if (!this.observer) return;
    this.observer.disconnect();
    const seen = new Set<Element>();
    const watch = (el: Element | null) => {
      if (el && el.isConnected && !seen.has(el)) {
        seen.add(el);
        this.observer!.observe(el);
      }
    };
    watch(this.lastTarget);
    for (const el of this.selection) watch(el);
  }

  // --- Mutations de sélection ----------------------------------------------

  private afterSelectionChange(): void {
    this.syncObserver();
    this.renderSelection();
    this.callbacks.onSelectionChange?.(this.selection.length);
    if (this.lastTarget && this.lastTarget.isConnected) {
      this.showHover(
        this.lastTarget,
        this.lastTarget.getBoundingClientRect(),
        false,
      );
    }
  }

  private toggleSelection(el: Element): void {
    const idx = this.selection.indexOf(el);
    if (idx >= 0) this.selection.splice(idx, 1);
    else this.selection.push(el);
    this.afterSelectionChange();
  }

  // --- Résultat -------------------------------------------------------------

  private buildResult(el: Element): PickResult {
    return {
      route: this.callbacks.getRoute(),
      xpath: getXPath(el),
      cssSelector: getCssSelector(el),
      tagName: el.tagName.toLowerCase(),
      id: el.id || null,
      reactComponent: null,
      reactSource: null,
    };
  }

  private finishMulti(): void {
    const results = this.selection
      .filter((el) => el.isConnected)
      .map((el) => this.buildResult(el));
    this.deactivate();
    this.callbacks.onPickMany?.(results);
  }

  /** Avale les events résiduels (pointerup/click) après un pick consommé. */
  private swallowTrailingPress(): void {
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const cleanup = () => {
      for (const type of PRESS_EVENTS) {
        window.removeEventListener(type, swallow, true);
      }
      window.removeEventListener("click", cleanup, true);
    };
    for (const type of PRESS_EVENTS) {
      window.addEventListener(type, swallow, true);
    }
    window.addEventListener("click", cleanup, true);
    setTimeout(cleanup, SWALLOW_MS);
  }

  // --- Handlers (arrow = identité stable pour add/remove) -------------------

  private onMouseMove = (e: MouseEvent): void => {
    const target = resolveTarget(e.clientX, e.clientY);
    if (!target || shouldIgnore(target)) {
      this.lastTarget = null;
      this.hideHover();
      return;
    }
    if (target === this.lastTarget) return;
    this.lastTarget = target;
    this.syncObserver();
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hideHover();
      return;
    }
    // Instantané à la (ré)apparition, glisse tant que le survol continue.
    this.showHover(target, rect, this.hovering);
  };

  private commands(): typeof DEFAULT_SETTINGS.commands {
    return this.callbacks.getCommands?.() ?? DEFAULT_SETTINGS.commands;
  }

  /** Type de clic de cet event (ou `null` : avalé mais sans action). */
  private kindOf(e: Event, me: MouseEvent): ClickTrigger | null {
    if (e.type === DOWN_TYPE && me.button === 0) return "click";
    if (e.type === "contextmenu") return "rightclick";
    if (e.type === "dblclick") return "dblclick";
    return null;
  }

  private onPress = (e: Event): void => {
    const me = e as MouseEvent;
    if (shouldIgnore(e.target as Element | null)) return;

    const target = this.pickTargetAt(me.clientX, me.clientY);
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const kind = this.kindOf(e, me);
    if (!kind) return;

    const cmds = this.commands();
    const isMulti = this.multi && gestureMatches(cmds.multi, me, kind);
    const isCopy = gestureMatches(cmds.copy, me, kind);
    const isCopyHtml = gestureMatches(cmds.copyHtml, me, kind);

    // Geste « multi » démarre la sélection ; ensuite le geste « copier » continue
    // d'ajouter / retirer (accumulation). Le geste « valider » (clavier) confirme.
    if (this.multi && (isMulti || (this.selection.length > 0 && isCopy))) {
      this.toggleSelection(target);
      return;
    }

    if (isCopy) {
      const result = this.buildResult(target);
      this.deactivate();
      this.swallowTrailingPress();
      this.callbacks.onPick(result);
      return;
    }

    // Copier l'HTML brut (clic droit par défaut). Après `copy` (prioritaire si même geste).
    if (isCopyHtml && this.callbacks.onCopyHtml) {
      const html = target.outerHTML;
      this.callbacks.onCopyHtml(html, target);
      this.deactivate();
      this.swallowTrailingPress();
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const cmds = this.commands();

    // Ctrl + touche « inspect » → ouvre le panneau pour l'élément survolé, puis désarme.
    if (
      cmds.inspect !== "off" &&
      e.ctrlKey &&
      e.key.toLowerCase() === cmds.inspect &&
      this.callbacks.onInspect &&
      this.lastTarget &&
      this.lastTarget.isConnected
    ) {
      e.preventDefault();
      e.stopPropagation();
      const el = this.lastTarget;
      this.deactivate();
      this.callbacks.onInspect(el);
      return;
    }

    if (keyMatches(cmds.confirm, e.key) && this.multi && this.selection.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      this.finishMulti();
      return;
    }
    if (keyMatches(cmds.cancel, e.key)) {
      e.preventDefault();
      e.stopPropagation();
      this.deactivate();
      this.callbacks.onCancel();
    }
  };

  // Ne touche QUE les markers de sélection : l'overlay de survol est piloté par
  // `mousemove` seul. Sinon les `transitionend`/`animationend` d'une page animée
  // réinitialiseraient en boucle la transition de l'overlay → pas de glisse.
  private refreshAll = (): void => {
    if (!this.active) return;
    this.renderSelection();
  };
}

export function createInspector(callbacks: InspectorCallbacks): {
  activate: () => void;
  deactivate: () => void;
  refreshDecorations: () => void;
} {
  const inspector = new Inspector(callbacks);
  return {
    activate: () => inspector.activate(),
    deactivate: () => inspector.deactivate(),
    refreshDecorations: () => inspector.refreshDecorations(),
  };
}
