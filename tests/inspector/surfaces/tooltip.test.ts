import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dimsText,
  tooltipClassSummary,
  tooltipMetrics,
  tooltipTitle,
} from "../../../src/core/inspector/surfaces/tooltip";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("tooltipTitle", () => {
  it("vide sans classe ni marqueur", () => {
    document.body.innerHTML = `<div></div>`;
    expect(tooltipTitle(document.querySelector("div")!, [])).toBe("");
  });

  it("vide sans classe ni composant/fibre", () => {
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

  it("summary : 3 classes max + (+n) + id vont SOUS le divider (métriques)", () => {
    document.body.innerHTML = `<div id="app" class="a b c d e"></div>`;
    const el = document.querySelector("div")!;
    expect(tooltipTitle(el, [])).toBe("");
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "block",
      paddingTop: "4px",
      paddingRight: "0px",
      paddingBottom: "0px",
      paddingLeft: "0px",
      rowGap: "0px",
      columnGap: "0px",
      marginTop: "0px",
      marginRight: "0px",
      marginBottom: "0px",
      marginLeft: "0px",
    } as CSSStyleDeclaration);
    expect(tooltipMetrics(el)).toBe(".a.b.c (+2) · #app\npadding: 4px 0px 0px 0px");
  });
});

describe("tooltipClassSummary", () => {
  it("3 premières classes + (+n), brut si pas plus", () => {
    document.body.innerHTML = `<div class="a b c d e"></div><div class="x"></div>`;
    const [app, solo] = Array.from(document.querySelectorAll("div"));
    expect(tooltipClassSummary(app!)).toBe(".a.b.c (+2)");
    expect(tooltipClassSummary(solo!)).toBe(".x");
  });

  it("vide sans classe", () => {
    document.body.innerHTML = `<div></div>`;
    expect(tooltipClassSummary(document.querySelector("div")!)).toBe("");
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

describe("dimsText", () => {
  it("formate largeur×hauteur arrondies", () => {
    expect(dimsText({ width: 120.4, height: 19.8 } as DOMRect)).toBe("120×20");
  });
});
