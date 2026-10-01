import { afterEach, describe, expect, it } from "vitest";

import { getXPath } from "../src/core/inspector/xpath";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("getXPath", () => {
  it("élément avec id → //*[@id]", () => {
    document.body.innerHTML = `<div id="hero"></div>`;
    const el = document.getElementById("hero")!;
    expect(getXPath(el)).toBe('//*[@id="hero"]');
  });

  it("ancre sur l'ancêtre porteur d'id", () => {
    document.body.innerHTML = `<section id="main"><span></span></section>`;
    const el = document.querySelector("span")!;
    expect(getXPath(el)).toBe('//*[@id="main"]/span');
  });

  it("indexe les frères de même tag (1-based)", () => {
    document.body.innerHTML = `<ul><li></li><li></li><li></li></ul>`;
    const third = document.querySelectorAll("li")[2]!;
    expect(getXPath(third)).toBe("/html/body/ul/li[3]");
  });

  it("pas d'index pour un tag unique parmi ses frères", () => {
    document.body.innerHTML = `<main><nav></nav><article></article></main>`;
    const article = document.querySelector("article")!;
    expect(getXPath(article)).toBe("/html/body/main/article");
  });

  it("vise le <svg> depuis un élément interne (chemin d'ancêtres complet)", () => {
    document.body.innerHTML = `<div><svg><circle></circle></svg></div>`;
    const circle = document.querySelector("circle")!;
    expect(getXPath(circle)).toBe("/html/body/div/svg");
  });

  it("préfixe /html/ et inclut body", () => {
    document.body.innerHTML = `<div></div>`;
    const el = document.querySelector("div")!;
    expect(getXPath(el)).toBe("/html/body/div");
  });
});
