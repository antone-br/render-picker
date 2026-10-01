import { afterEach, describe, expect, it } from "vitest";

import { getCssSelector, getElementSelector } from "../src/core/inspector/css-selector";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("getElementSelector", () => {
  it("id → #id", () => {
    document.body.innerHTML = `<div id="hero" class="a b"></div>`;
    expect(getElementSelector(document.getElementById("hero")!)).toBe("#hero");
  });

  it("tag + classes retenues, ignore les classes hash css-xxxx", () => {
    document.body.innerHTML = `<div class="flex css-1a2b3c gap-4"></div>`;
    expect(getElementSelector(document.querySelector("div")!)).toBe(
      "div.flex.gap-4",
    );
  });

  it(":nth-child quand frères de même tag + mêmes classes", () => {
    document.body.innerHTML = `<ul><li class="row"></li><li class="row"></li></ul>`;
    const second = document.querySelectorAll("li")[1]!;
    expect(getElementSelector(second)).toBe("li.row:nth-child(2)");
  });

  it("pas de :nth-child si les classes diffèrent", () => {
    document.body.innerHTML = `<ul><li class="row"></li><li class="row active"></li></ul>`;
    const first = document.querySelectorAll("li")[0]!;
    expect(getElementSelector(first)).toBe("li.row");
  });
});

describe("getCssSelector", () => {
  it("id → #id direct", () => {
    document.body.innerHTML = `<div id="hero"></div>`;
    expect(getCssSelector(document.getElementById("hero")!)).toBe("#hero");
  });

  it("s'arrête dès que le chemin est unique", () => {
    document.body.innerHTML = `<main><span class="only"></span></main>`;
    const span = document.querySelector("span")!;
    expect(getCssSelector(span)).toBe("span.only");
  });

  it("chaîne avec > quand nécessaire pour l'unicité", () => {
    document.body.innerHTML = `<div class="box"><p class="t"></p></div><div class="box2"><p class="t"></p></div>`;
    const firstP = document.querySelector(".box p")!;
    expect(getCssSelector(firstP)).toBe("div.box > p.t");
  });
});
