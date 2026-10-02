import { afterEach, describe, expect, it, vi } from "vitest";

import {
  containsPoint,
  resolveTarget,
  shouldIgnore,
} from "../../src/core/inspector/hit-test";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("shouldIgnore", () => {
  it("vrai si l'élément ou un ancêtre porte data-pathpicker-ignore", () => {
    document.body.innerHTML = `<div data-pathpicker-ignore><span id="s"></span></div><p id="p"></p>`;
    expect(shouldIgnore(document.getElementById("s"))).toBe(true);
    expect(shouldIgnore(document.getElementById("p"))).toBe(false);
    expect(shouldIgnore(null)).toBe(false);
  });
});

describe("containsPoint", () => {
  it("teste l'appartenance du point au rect de l'élément", () => {
    const el = document.createElement("div");
    // jsdom renvoie des rects 0×0 → on stube getBoundingClientRect.
    el.getBoundingClientRect = () =>
      ({ left: 10, right: 50, top: 10, bottom: 30, width: 40, height: 20 }) as DOMRect;
    expect(containsPoint(el, 20, 20)).toBe(true);
    expect(containsPoint(el, 100, 100)).toBe(false);
  });
});

describe("resolveTarget", () => {
  it("retourne l'élément sous le point, null si ignoré", () => {
    document.body.innerHTML = `<main><button id="b">x</button></main>`;
    const btn = document.getElementById("b")!;
    document.elementFromPoint = () => btn;
    expect(resolveTarget(5, 5)).toBe(btn);

    const ignored = document.createElement("div");
    ignored.setAttribute("data-pathpicker-ignore", "");
    document.body.appendChild(ignored);
    document.elementFromPoint = () => ignored;
    expect(resolveTarget(5, 5)).toBeNull();
  });

  it("s'arrête sur un élément désactivé (ne descend pas dans son contenu)", () => {
    document.body.innerHTML = `<main><button id="b" disabled><svg id="i"></svg></button></main>`;
    const main = document.querySelector("main")!;
    const btn = document.getElementById("b")!;
    const svg = document.getElementById("i")!;
    // disabled → PICKING_CSS met pointer-events:none → elementFromPoint renvoie le parent.
    document.elementFromPoint = () => main;
    // button + svg sont pointer-events:none (hérité) et sous le point.
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) =>
      el === btn || el === svg
        ? ({ pointerEvents: "none", visibility: "visible", opacity: "1" } as CSSStyleDeclaration)
        : real(el as Element),
    );
    const rectOf = (l: number, t: number, r: number, b: number) =>
      () => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t }) as DOMRect;
    main.getBoundingClientRect = rectOf(0, 0, 100, 100);
    btn.getBoundingClientRect = rectOf(10, 10, 90, 40);
    svg.getBoundingClientRect = rectOf(12, 12, 28, 38);

    // (20,25) est dans le svg, mais la cible doit rester le bouton désactivé.
    expect(resolveTarget(20, 25)).toBe(btn);
  });
});
