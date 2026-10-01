import { afterEach, describe, expect, it } from "vitest";

import {
  containsPoint,
  resolveTarget,
  shouldIgnore,
} from "../src/core/inspector/hit-test";

afterEach(() => {
  document.body.innerHTML = "";
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
});
