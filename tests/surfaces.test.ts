import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSurfaces,
  dimsText,
  positionOverlay,
  renderDecorations,
  tooltipMetrics,
  tooltipTitle,
} from "../src/core/inspector/surfaces";
import { OVERLAY_GLIDE } from "../src/core/inspector/pick-style";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("tooltipTitle", () => {
  it("vide sans composant ni marqueur (plus de <div>)", () => {
    document.body.innerHTML = `<div class="flex"></div>`;
    expect(tooltipTitle(document.querySelector("div")!, [])).toBe("");
  });

  it("marque · disabled", () => {
    document.body.innerHTML = `<button disabled></button>`;
    expect(tooltipTitle(document.querySelector("button")!, [])).toBe("disabled");
  });

  it("marque selected #n selon la position", () => {
    document.body.innerHTML = `<span></span><span></span>`;
    const [a, b] = Array.from(document.querySelectorAll("span"));
    expect(tooltipTitle(b!, [a!, b!])).toBe("selected #2");
  });
});

describe("tooltipMetrics", () => {
  it("padding/gap en px si présents, rien sinon", () => {
    document.body.innerHTML = `<div></div>`;
    const el = document.querySelector("div")!;
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "flex",
      paddingTop: "10px",
      paddingRight: "10px",
      paddingBottom: "10px",
      paddingLeft: "10px",
      rowGap: "8px",
      columnGap: "8px",
      marginTop: "0px",
      marginRight: "0px",
      marginBottom: "0px",
      marginLeft: "0px",
    } as CSSStyleDeclaration);
    expect(tooltipMetrics(el)).toBe("padding: 10px\ngap: 8px");
  });

  it("vide si aucune métrique", () => {
    document.body.innerHTML = `<div></div>`;
    expect(tooltipMetrics(document.querySelector("div")!)).toBe("");
  });
});

describe("renderDecorations", () => {
  it("padding → 4 bandes vertes, vidées si padding:false", () => {
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

  it("gap : rangée flex 3 enfants → 2 bandes consécutives, aucune ne traverse le texte", () => {
    const layer = document.createElement("div");
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 300, bottom: 40, width: 300, height: 40 }) as DOMRect;
    const mk = (left: number, right: number): Element =>
      ({
        getBoundingClientRect: () =>
          ({ left, right, top: 10, bottom: 30, width: right - left, height: 20 }) as DOMRect,
      }) as Element;
    // icône [0,30] · texte [42,220] · bouton [232,300]
    const kids = [mk(0, 30), mk(42, 220), mk(232, 300)];
    Object.defineProperty(el, "children", { value: kids, configurable: true });
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "flex",
    } as CSSStyleDeclaration);

    renderDecorations(layer, el, el.getBoundingClientRect(), {
      padding: false,
      gap: true,
      margin: false,
    });

    const children = Array.from(layer.children) as HTMLElement[];
    const strips = children.filter((c) => c.style.borderStyle !== "dashed");
    const dashed = children.filter((c) => c.style.borderStyle === "dashed");

    // 2 bandes (icône-texte, texte-bouton), aux bons left/width, pleine hauteur content-box.
    expect(strips.map((c) => parseFloat(c.style.left))).toEqual([30, 220]);
    expect(strips.map((c) => parseFloat(c.style.width))).toEqual([12, 12]);
    expect(strips.map((c) => parseFloat(c.style.height))).toEqual([40, 40]);
    // 1 contour pointillé autour du conteneur.
    expect(dashed.length).toBe(1);
  });
});

describe("dimsText", () => {
  it("formate largeur×hauteur arrondies", () => {
    expect(dimsText({ width: 120.4, height: 19.8 } as DOMRect)).toBe("120×20");
  });
});

describe("positionOverlay", () => {
  const rect = {
    top: 10,
    left: 20,
    width: 100,
    height: 40,
  } as DOMRect;

  it("positionne + affiche, glisse actif par défaut", () => {
    const { overlay } = createSurfaces();
    positionOverlay(overlay, rect);
    expect(overlay.style.opacity).toBe("1");
    expect(overlay.style.top).toBe("10px");
    expect(overlay.style.left).toBe("20px");
    expect(overlay.style.width).toBe("100px");
    expect(overlay.style.height).toBe("40px");
    expect(overlay.style.transition).toBe(OVERLAY_GLIDE);
  });

  it("animate=false : positionne instantanément puis réactive le glisse", () => {
    const { overlay } = createSurfaces();
    positionOverlay(overlay, rect, false);
    expect(overlay.style.top).toBe("10px");
    expect(overlay.style.opacity).toBe("1");
    expect(overlay.style.transition).toBe(OVERLAY_GLIDE);
  });
});
