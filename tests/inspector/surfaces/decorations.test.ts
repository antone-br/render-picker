import { afterEach, describe, expect, it, vi } from "vitest";

import { renderDecorations } from "../../../src/core/inspector/surfaces/decorations";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("renderDecorations", () => {
  it("padding → un div bordé (radius overlay), vidé si padding:false", () => {
    const layer = document.createElement("div");
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "block",
      borderTopWidth: "0px",
      borderRightWidth: "0px",
      borderBottomWidth: "0px",
      borderLeftWidth: "0px",
      paddingTop: "10px",
      paddingRight: "10px",
      paddingBottom: "10px",
      paddingLeft: "10px",
    } as CSSStyleDeclaration);

    renderDecorations(layer, el, el.getBoundingClientRect(), {
      padding: true,
      gap: false,
      margin: false,
    });
    expect(layer.children.length).toBe(1);
    const ring = layer.firstElementChild as HTMLElement;
    expect(ring.style.borderTopWidth).toBe("10px");
    expect(ring.style.borderRadius).toBe("3px");

    renderDecorations(layer, el, el.getBoundingClientRect(), {
      padding: false,
      gap: false,
      margin: false,
    });
    expect(layer.children.length).toBe(0);
  });

  it("gap : rangée flex 3 enfants → 2 bandes consécutives + 1 pointillé", () => {
    const layer = document.createElement("div");
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 300, bottom: 40, width: 300, height: 40 }) as DOMRect;
    const mk = (left: number, right: number): ChildNode =>
      ({
        nodeType: 1,
        getBoundingClientRect: () =>
          ({ left, right, top: 10, bottom: 30, width: right - left, height: 20 }) as DOMRect,
      }) as unknown as ChildNode;
    // icône [0,30] · texte [42,220] · bouton [232,300]
    const kids = [mk(0, 30), mk(42, 220), mk(232, 300)];
    Object.defineProperty(el, "childNodes", { value: kids, configurable: true });
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "flex",
      rowGap: "0px",
      columnGap: "12px",
    } as CSSStyleDeclaration);

    renderDecorations(layer, el, el.getBoundingClientRect(), {
      padding: false,
      gap: true,
      margin: false,
    });

    const children = Array.from(layer.children) as HTMLElement[];
    const strips = children.filter((c) => c.tagName.toLowerCase() !== "svg");
    const dashed = children.filter((c) => c.tagName.toLowerCase() === "svg");

    // 2 bandes (icône-texte, texte-bouton), bons left/width, pleine hauteur content-box.
    expect(strips.map((c) => parseFloat(c.style.left))).toEqual([30, 220]);
    expect(strips.map((c) => parseFloat(c.style.width))).toEqual([12, 12]);
    expect(strips.map((c) => parseFloat(c.style.height))).toEqual([40, 40]);
    // 1 contour pointillé autour du conteneur.
    expect(dashed.length).toBe(1);
  });

  it("gap : rien dessiné si le conteneur n'a pas de gap CSS (espacement par marges)", () => {
    const layer = document.createElement("div");
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }) as DOMRect;
    const mk = (top: number, bottom: number): ChildNode =>
      ({
        nodeType: 1,
        getBoundingClientRect: () =>
          ({ left: 0, right: 100, top, bottom, width: 100, height: bottom - top }) as DOMRect,
      }) as unknown as ChildNode;
    // enfants empilés, espacés par des marges (pas de gap)
    Object.defineProperty(el, "childNodes", {
      value: [mk(0, 20), mk(30, 50)],
      configurable: true,
    });
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "flex",
      rowGap: "0px",
      columnGap: "0px",
    } as CSSStyleDeclaration);

    renderDecorations(layer, el, el.getBoundingClientRect(), {
      padding: false,
      gap: true,
      margin: false,
    });
    expect(layer.children.length).toBe(0);
  });
});
