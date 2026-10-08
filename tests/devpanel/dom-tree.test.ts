import { afterEach, describe, expect, it } from "vitest";

import {
  ancestorsUpTo,
  inlineText,
  isElementSkippable,
  nodeLabel,
  visibleChildren,
} from "../../src/core/devpanel/dom-tree";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("nodeLabel", () => {
  it("décompose tag / id / classes", () => {
    document.body.innerHTML = '<div id="app" class="a b"></div>';
    const el = document.getElementById("app")!;
    expect(nodeLabel(el)).toEqual({ tag: "div", id: "app", classes: ["a", "b"] });
  });

  it("id null et classes vides si absents", () => {
    document.body.innerHTML = "<section></section>";
    expect(nodeLabel(document.querySelector("section")!)).toEqual({
      tag: "section",
      id: null,
      classes: [],
    });
  });
});

describe("isElementSkippable", () => {
  it("vrai sous un nœud [data-pathpicker-ignore]", () => {
    document.body.innerHTML =
      '<main><div id="ok"></div></main>' +
      '<aside data-pathpicker-ignore=""><div id="ui"></div></aside>';
    expect(isElementSkippable(document.getElementById("ok")!)).toBe(false);
    expect(isElementSkippable(document.getElementById("ui")!)).toBe(true);
    expect(isElementSkippable(document.querySelector("aside")!)).toBe(true);
  });
});

describe("visibleChildren", () => {
  it("garde les enfants éléments, exclut l'UI render-picker", () => {
    document.body.innerHTML =
      '<ul><li class="a"></li><li class="b"></li>' +
      '<span data-pathpicker-ignore=""></span></ul>';
    const kids = visibleChildren(document.querySelector("ul")!);
    expect(kids.map((e) => e.className)).toEqual(["a", "b"]);
  });
});

describe("ancestorsUpTo", () => {
  it("renvoie parent → … → root (el exclu)", () => {
    document.body.innerHTML = '<main><section><article id="deep"></article></section></main>';
    const deep = document.getElementById("deep")!;
    const chain = ancestorsUpTo(deep, document.body);
    expect(chain.map((e) => e.tagName.toLowerCase())).toEqual(["section", "main", "body"]);
  });
});

describe("inlineText", () => {
  it("texte d'une feuille", () => {
    document.body.innerHTML = "<h1>  Titre  </h1>";
    expect(inlineText(document.querySelector("h1")!)).toBe("Titre");
  });

  it("null si l'élément a des enfants éléments", () => {
    document.body.innerHTML = "<div><span>x</span></div>";
    expect(inlineText(document.querySelector("div")!)).toBeNull();
  });

  it("null si feuille sans texte", () => {
    document.body.innerHTML = "<br>";
    expect(inlineText(document.querySelector("br")!)).toBeNull();
  });

  it("borne la longueur", () => {
    document.body.innerHTML = `<p>${"x".repeat(200)}</p>`;
    const text = inlineText(document.querySelector("p")!)!;
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(81);
  });
});
