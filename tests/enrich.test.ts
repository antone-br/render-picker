import { beforeEach, describe, expect, it } from "vitest";

import { enrichResult, findPickedElement } from "../src/core/source/enrich";

const base = {
  route: "/",
  tagName: "span",
  id: null,
};

beforeEach(() => {
  document.body.innerHTML = `
    <main data-component="Page" data-source="src/app/page.tsx:10">
      <section>
        <span class="label">hello</span>
      </section>
    </main>
    <div id="orphan"><b>x</b></div>
  `;
});

describe("findPickedElement", () => {
  it("retrouve l'élément par XPath", () => {
    const el = findPickedElement({
      xpath: "/html/body/main/section/span",
      cssSelector: "",
    });
    expect(el?.textContent).toBe("hello");
  });

  it("fallback CSS si XPath invalide", () => {
    const el = findPickedElement({ xpath: "///[", cssSelector: "span.label" });
    expect(el?.className).toBe("label");
  });

  it("null si rien ne matche", () => {
    expect(
      findPickedElement({ xpath: "/html/body/nav", cssSelector: "nav" }),
    ).toBeNull();
  });
});

describe("enrichResult", () => {
  it("complète reactSource et reactComponent depuis l'ancêtre annoté", () => {
    const r = enrichResult({
      ...base,
      xpath: "/html/body/main/section/span",
      cssSelector: "span.label",
      reactComponent: null,
      reactSource: null,
    });
    expect(r.reactSource).toBe("src/app/page.tsx:10");
    expect(r.reactComponent).toBe("Page");
  });

  it("conserve les valeurs déjà fournies par l'inspecteur", () => {
    const r = enrichResult({
      ...base,
      xpath: "/html/body/main/section/span",
      cssSelector: "span.label",
      reactComponent: "Label",
      reactSource: null,
    });
    expect(r.reactComponent).toBe("Label");
    expect(r.reactSource).toBe("src/app/page.tsx:10");
  });

  it("laisse null sans annotation", () => {
    const r = enrichResult({
      ...base,
      xpath: '//*[@id="orphan"]/b',
      cssSelector: "#orphan > b",
      reactComponent: null,
      reactSource: null,
    });
    expect(r.reactSource).toBeNull();
    expect(r.reactComponent).toBeNull();
  });
});
