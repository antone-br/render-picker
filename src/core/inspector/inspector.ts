import type { InspectorCallbacks, PickResult } from "../types";
import { DOWN_TYPE, IGNORE_ATTR, PRESS_EVENTS, SWALLOW_MS } from "./constants";
import { getCssSelector } from "./css-selector";
import { containsPoint, resolveTarget, shouldIgnore } from "./hit-test";
import { PICKING_CSS } from "./pick-style";
import {
  createSurfaces,
  hideHover,
  positionOverlay,
  renderHud,
  renderMarkers,
  updateTooltip,
  type Surfaces,
} from "./surfaces";
import { getXPath } from "./xpath";

/**
 * Inspecteur DOM impératif, sans React. Survol → overlay + tooltip ; clic →
 * pick ; Maj+clic → accumulation ; Entrée → confirme ; Échap → annule. Produit
 * un `PickResult` partiel (route/xpath/css/tagName/id) — l'enrichissement React
 * (`reactComponent`/`reactSource`) se fait côté appelant via `enrichResult`.
 *
 * `activate()` installe tout, `deactivate()` démonte tout (règle : tout init a
 * son cleanup). No-op en SSR. Orchestration uniquement : le hit-test vit dans
 * `hit-test.ts`, les surfaces DOM dans `surfaces.ts`.
 */
class Inspector {
  private active = false;
  private styleEl: HTMLStyleElement | null = null;
  private surfaces: Surfaces | null = null;
  private lastTarget: Element | null = null;
  private selection: Element[] = [];
  private observer: ResizeObserver | null = null;

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

    this.renderHud();
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
    if (this.surfaces) hideHover(this.surfaces.overlay, this.surfaces.tooltip);
  }

  private showHover(el: Element, rect: DOMRect): void {
    if (!this.surfaces) return;
    positionOverlay(this.surfaces.overlay, rect);
    updateTooltip(this.surfaces.tooltip, el, this.selection, rect);
  }

  private renderHud(): void {
    if (this.surfaces) renderHud(this.surfaces.hud);
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
    this.renderHud();
    if (this.lastTarget && this.lastTarget.isConnected) {
      this.showHover(this.lastTarget, this.lastTarget.getBoundingClientRect());
    }
  }

  private toggleSelection(el: Element): void {
    const idx = this.selection.indexOf(el);
    if (idx >= 0) this.selection.splice(idx, 1);
    else this.selection.push(el);
    this.afterSelectionChange();
  }

  private setSelection(els: Element[]): void {
    this.selection = els;
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
    this.showHover(target, rect);
  };

  private onPress = (e: Event): void => {
    const me = e as MouseEvent;
    if (shouldIgnore(e.target as Element | null)) return;

    const target = this.pickTargetAt(me.clientX, me.clientY);
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (e.type !== DOWN_TYPE || me.button !== 0) return;

    if (this.multi && me.shiftKey) {
      this.toggleSelection(target);
      return;
    }
    if (this.multi && this.selection.length > 0) {
      this.setSelection([target]);
      return;
    }

    const result = this.buildResult(target);
    this.deactivate();
    this.swallowTrailingPress();
    this.callbacks.onPick(result);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" && this.multi && this.selection.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      this.finishMulti();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.deactivate();
      this.callbacks.onCancel();
    }
  };

  private refreshAll = (): void => {
    if (!this.active) return;
    if (this.lastTarget && this.lastTarget.isConnected) {
      const rect = this.lastTarget.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) this.hideHover();
      else this.showHover(this.lastTarget, rect);
    }
    this.renderSelection();
  };
}

export function createInspector(callbacks: InspectorCallbacks): {
  activate: () => void;
  deactivate: () => void;
} {
  const inspector = new Inspector(callbacks);
  return {
    activate: () => inspector.activate(),
    deactivate: () => inspector.deactivate(),
  };
}
