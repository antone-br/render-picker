import { afterEach, describe, expect, it, vi } from "vitest";

import { serializeWithComputedStyles } from "../src/core/computed-html";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("serializeWithComputedStyles", () => {
  it("préserve la structure et le texte du sous-arbre", () => {
    document.body.innerHTML = `<div id="a"><span>x</span></div>`;
    const html = serializeWithComputedStyles(document.getElementById("a")!);
    expect(html).toContain("<div");
    expect(html).toContain("<span");
    expect(html).toContain("x");
  });

  it("renvoie une string et nettoie l'iframe sandbox", () => {
    document.body.innerHTML = `<section></section>`;
    const out = serializeWithComputedStyles(document.querySelector("section")!);
    expect(typeof out).toBe("string");
    // Aucune iframe sandbox résiduelle après l'appel.
    expect(document.querySelector("iframe[data-pathpicker-ignore]")).toBeNull();
  });

  it("exclut les variables CSS (--*) de la sortie", () => {
    document.body.innerHTML = `<div id="a"></div>`;
    const el = document.getElementById("a")!;
    // Stub getComputedStyle : l'élément a une var --x + une prop normale ; l'iframe
    // (baseline) renvoie une liste vide → tout « non-défaut ».
    const fakeFor = (node: Element) => {
      const isTarget = node === el;
      const list = isTarget ? ["--x", "color"] : [];
      const values: Record<string, string> = { "--x": "red", color: "rgb(0, 0, 0)" };
      return {
        length: list.length,
        0: list[0],
        1: list[1],
        getPropertyValue: (p: string) => (isTarget ? (values[p] ?? "") : ""),
      } as unknown as CSSStyleDeclaration;
    };
    vi.stubGlobal("getComputedStyle", fakeFor);

    const out = serializeWithComputedStyles(el);
    expect(out).not.toContain("--x");
    expect(out).toContain("color");
  });

  it("préserve la casse des éléments SVG (linearGradient / clipPath)", () => {
    document.body.innerHTML =
      `<svg id="s"><defs><linearGradient id="g"></linearGradient></defs>` +
      `<clipPath id="c"><rect></rect></clipPath><path fill="url(#g)"></path></svg>`;
    const out = serializeWithComputedStyles(document.getElementById("s")!);
    expect(out).toContain("<linearGradient");
    expect(out).toContain("<clipPath");
    expect(out).not.toContain("<lineargradient");
    expect(out).not.toContain("<clippath");
    document.body.innerHTML = "";
  });

  it("annote chaque balise avec le CSS de ses classes (commentaire sous la balise)", () => {
    document.head.innerHTML = `<style>.foo{font-weight:500}</style>`;
    document.body.innerHTML = `<div class="foo bar">x</div>`;
    const out = serializeWithComputedStyles(document.querySelector(".foo")!);
    expect(out).toContain("<!--");
    expect(out).toContain(".foo { font-weight: 500 }");
    // `bar` n'a aucune règle → non listé.
    expect(out).not.toContain(".bar {");
    document.head.innerHTML = "";
  });

  it("classes partagées → bloc global en bas ; classes propres sous la balise", () => {
    document.head.innerHTML = `<style>.shared{display:flex}.ua{color:red}.ub{color:blue}</style>`;
    document.body.innerHTML =
      `<div class="shared ua"><span class="shared ub">x</span></div>`;
    const out = serializeWithComputedStyles(document.querySelector("div")!);
    // shared (2 balises) → bloc global en bas.
    expect(out).toContain("Classes globales");
    expect(out).toContain(".shared { display: flex }");
    const globalIdx = out.indexOf("Classes globales");
    // ua / ub (propres) → sous leur balise, AVANT le bloc global.
    expect(out.indexOf(".ua { color: red }")).toBeGreaterThan(-1);
    expect(out.indexOf(".ua { color: red }")).toBeLessThan(globalIdx);
    expect(out.indexOf(".ub { color: blue }")).toBeLessThan(globalIdx);
    // shared pas répété comme classe propre.
    expect(out.indexOf(".shared {")).toBeGreaterThan(globalIdx);
    document.head.innerHTML = "";
  });

  it("résout les var(--x) des classes dans un bloc Variables CSS", () => {
    document.head.innerHTML = `<style>.foo{font-size:var(--text-lg)}</style>`;
    document.body.innerHTML = `<div class="foo" style="--text-lg: 1.125rem">x</div>`;
    const out = serializeWithComputedStyles(document.querySelector(".foo")!);
    expect(out).toContain("Variables CSS");
    expect(out).toContain("--text-lg: 1.125rem");
    document.head.innerHTML = "";
  });

  it("émet les règles d'état (:hover) dans un <style> avec !important", () => {
    document.head.innerHTML = `<style>.btn{color:red}.btn:hover{color:blue}</style>`;
    document.body.innerHTML = `<button class="btn">x</button>`;
    const out = serializeWithComputedStyles(document.querySelector(".btn")!);
    expect(out).toContain("<style>");
    expect(out).toContain(".btn:hover");
    expect(out).toContain("color: blue !important");
    document.head.innerHTML = "";
  });

  it("résout les var() des règles d'état dans le <style>", () => {
    document.head.innerHTML = `<style>.btn:hover{color:var(--accent)}</style>`;
    document.body.innerHTML = `<button class="btn" style="--accent: #3b82f6">x</button>`;
    const out = serializeWithComputedStyles(document.querySelector(".btn")!);
    expect(out).toContain(".btn:hover");
    expect(out).toContain("#3b82f6 !important");
    expect(out).not.toContain("var(--accent)");
    document.head.innerHTML = "";
  });

  it("pas de <style> quand aucune règle d'état", () => {
    document.head.innerHTML = `<style>.btn{color:red}</style>`;
    document.body.innerHTML = `<button class="btn">x</button>`;
    const out = serializeWithComputedStyles(document.querySelector(".btn")!);
    expect(out).not.toContain("<style>");
    document.head.innerHTML = "";
  });

  it("fallback (getComputedStyle absent) → outerHTML formaté", () => {
    document.body.innerHTML = `<p>hi</p>`;
    const el = document.querySelector("p")!;
    vi.stubGlobal("getComputedStyle", undefined);
    const out = serializeWithComputedStyles(el);
    expect(out).toContain("<p>");
    expect(out).toContain("hi");
  });
});
