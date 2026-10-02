import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dimsText,
  tooltipMetrics,
  tooltipTitle,
} from "../../../src/core/inspector/surfaces/tooltip";

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

describe("dimsText", () => {
  it("formate largeur×hauteur arrondies", () => {
    expect(dimsText({ width: 120.4, height: 19.8 } as DOMRect)).toBe("120×20");
  });
});
