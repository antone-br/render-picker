import { afterEach, describe, expect, it, vi } from "vitest";

import { createSearchHighlight } from "../../src/core/search/highlight";

const RECT_SELECTOR = "[data-pathpicker-ignore] > [data-rp-search-ui]";

afterEach(() => {
  document.documentElement.innerHTML = "";
});

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  (el as unknown as { scrollIntoView?: unknown }).scrollIntoView = () => {};
  return el;
}

describe("createSearchHighlight", () => {
  it("attache une couche fixe ignorée par le picker (z OVERLAY_Z)", () => {
    const hl = createSearchHighlight();
    const layer = document.querySelector<HTMLElement>("[data-pathpicker-ignore]");
    expect(layer).not.toBeNull();
    expect(layer!.style.position).toBe("fixed");
    expect(layer!.style.zIndex).toBeTruthy();
    hl.destroy();
    expect(document.querySelector("[data-pathpicker-ignore]")).toBeNull();
  });

  it("update : un rect par résultat, style de survol (fond translucide)", () => {
    const hl = createSearchHighlight();
    hl.update([makeEl(), makeEl()]);

    const rects = Array.from(
      document.querySelectorAll<HTMLElement>(RECT_SELECTOR),
    );
    expect(rects).toHaveLength(2);
    expect(rects[0]!.style.background).toBe("rgba(59, 130, 246, 0.15)");
    expect(rects[0]!.style.display).toBe("block");
    hl.destroy();
  });

  it("setFilter : survol d'une ligne → SEULES ces occurrences visibles", () => {
    const hl = createSearchHighlight();
    hl.update([makeEl(), makeEl(), makeEl()]);
    const rects = () =>
      Array.from(document.querySelectorAll<HTMLElement>(RECT_SELECTOR));

    hl.setFilter([1]);
    const visible = rects().filter((r) => r.style.display === "block");
    expect(visible).toHaveLength(1);
    expect(visible[0]).toBe(rects()[1]);

    hl.setFilter(null);
    expect(rects().filter((r) => r.style.display === "block")).toHaveLength(3);

    hl.setFilter([0, 2]);
    expect(rects()[1]!.style.display).toBe("none");
    expect(rects()[0]!.style.display).toBe("block");
    expect(rects()[2]!.style.display).toBe("block");
    hl.destroy();
  });

  it("setActive : indices multiples nets (sélection de groupe)", () => {
    const hl = createSearchHighlight();
    hl.update([makeEl(), makeEl(), makeEl()]);
    hl.setActive([0, 2]);

    const rects = Array.from(
      document.querySelectorAll<HTMLElement>(RECT_SELECTOR),
    );
    expect(rects[0]!.style.background).toBe("rgba(59, 130, 246, 0.24)");
    expect(rects[1]!.style.background).toBe("rgba(59, 130, 246, 0.15)");
    expect(rects[2]!.style.background).toBe("rgba(59, 130, 246, 0.24)");
    hl.destroy();
  });

  it("update réinitialise le filtre (tous les rects reviennent)", () => {
    const hl = createSearchHighlight();
    hl.update([makeEl(), makeEl()]);
    hl.setFilter([0]);
    hl.update([makeEl(), makeEl()]);
    const rects = Array.from(document.querySelectorAll<HTMLElement>(RECT_SELECTOR));
    expect(rects.every((r) => r.style.display === "block")).toBe(true);
    hl.destroy();
  });

  it("update réutilise les rects (pas de duplication au refetch)", () => {
    const hl = createSearchHighlight();
    hl.update([makeEl(), makeEl(), makeEl()]);
    hl.update([makeEl(), makeEl()]);

    const rects = Array.from(
      document.querySelectorAll<HTMLElement>(RECT_SELECTOR),
    );
    expect(rects).toHaveLength(3);
    expect(rects[2]!.style.display).toBe("none");
    hl.destroy();
  });

  it("clear : plus aucun rect visible, la couche reste", () => {
    const hl = createSearchHighlight();
    hl.update([makeEl()]);
    hl.clear();

    expect(document.querySelector<HTMLElement>("[data-pathpicker-ignore]")).not.toBeNull();
    const rects = Array.from(
      document.querySelectorAll<HTMLElement>(RECT_SELECTOR),
    );
    expect(rects.every((r) => r.style.display === "none")).toBe(true);
    hl.destroy();
  });

  it("clic sur un rect → callback onPick (côté appelant)", () => {
    const picks: HTMLElement[] = [];
    const hl = createSearchHighlight({ onPick: (el) => picks.push(el) });
    const el = makeEl();
    hl.update([el]);

    const rectEl = document.querySelector<HTMLElement>(RECT_SELECTOR)!;
    rectEl.onclick?.(new MouseEvent("click") as unknown as PointerEvent);

    expect(picks).toHaveLength(1);
    expect(picks[0]).toBe(el);
    hl.destroy();
  });

  it("clic droit sur un rect → crée un menu contextuel (el + pos)", () => {
    const menus: [HTMLElement, { x: number; y: number }][] = [];
    const hl = createSearchHighlight({
      onContextMenu: (el, pos) => menus.push([el, pos]),
    });
    const el = makeEl();
    hl.update([el]);

    const rectEl = document.querySelector<HTMLElement>(RECT_SELECTOR)!;
    rectEl.oncontextmenu?.(
      new MouseEvent("contextmenu", { clientX: 40, clientY: 60 }) as unknown as PointerEvent,
    );

    expect(menus).toHaveLength(1);
    expect(menus[0]![0]).toBe(el);
    expect(menus[0]![1]).toEqual({ x: 40, y: 60 });
    hl.destroy();
  });

  it("Ctrl+Alt+clic sur rect → onVscode (source), pas de pick ; Alt → usage", () => {
    const opens: [HTMLElement, string][] = [];
    const picks: HTMLElement[] = [];
    const hl = createSearchHighlight({
      onPick: (el) => picks.push(el),
      onVscode: (el, action) => {
        opens.push([el, action]);
        return true;
      },
    });
    const el = makeEl();
    hl.update([el]);

    const rectEl = document.querySelector<HTMLElement>(RECT_SELECTOR)!;
    rectEl.onclick?.(
      new MouseEvent("click", { ctrlKey: true }) as unknown as PointerEvent,
    );
    rectEl.onclick?.(
      new MouseEvent("click", { altKey: true }) as unknown as PointerEvent,
    );

    expect(opens).toEqual([
      [el, "usage"], // usage prioritaire (Ctrl)
      [el, "source"],
    ]);
    expect(picks).toHaveLength(0);
    hl.destroy();
  });

  it("destroy : arrête la boucle rAF (plus de redraw)", async () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const hl = createSearchHighlight();
    hl.update([makeEl()]);
    hl.destroy();
    const atDestroy = rafSpy.mock.calls.length;
    await new Promise((r) => setTimeout(r, 20));
    expect(rafSpy.mock.calls.length).toBe(atDestroy);
  });

  it("hover d'un rect → tooltip : composant + métriques + dims", () => {
    const hl = createSearchHighlight();
    const el = makeEl();
    el.setAttribute("data-component", "Card");
    el.style.padding = "4px";
    Object.defineProperty(el, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, right: 120, bottom: 20, width: 120, height: 20 }),
      configurable: true,
    });
    hl.update([el]);

    const layer = document.querySelector<HTMLElement>("[data-pathpicker-ignore]")!;
    const tooltip = layer.firstElementChild as HTMLElement;

    expect(tooltip.style.display).toBe("none");

    const rectEl = document.querySelector<HTMLElement>(RECT_SELECTOR)!;
    rectEl.onmouseenter?.(new MouseEvent("mouseenter"));
    expect(rectEl.style.background).toBe("rgba(59, 130, 246, 0.24)");
    expect(tooltip.style.display).toBe("flex");
    // Dims = badge dimensions (le label composants dépend des fibers React, absentes en jsdom).
    const badge = tooltip.children[tooltip.children.length - 1] as HTMLElement;
    expect(badge.textContent).toContain("120×20");

    rectEl.onmouseleave?.(new MouseEvent("mouseleave"));
    expect(tooltip.style.display).toBe("none");
    hl.destroy();
  });
});
