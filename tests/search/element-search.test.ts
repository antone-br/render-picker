import { afterEach, describe, expect, it } from "vitest";

import {
  pickResultFromElement,
  searchElements,
  toSelector,
} from "../../src/core/search/element-search";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("toSelector", () => {
  it("tag simple : tag exact OU classe du même nom", () => {
    expect(toSelector("div")).toBe(
      'div, .div, [data-component="div" i]',
    );
  });

  it("mot libre : inclut aussi le nom de composant React (data-component)", () => {
    document.body.innerHTML =
      '<section data-component="Button"><span>1</span></section>' +
      '<div class="Button">2</div>';
    const found = searchElements("Button");
    expect(found).toHaveLength(2);
    expect(found[0]!.getAttribute("data-component")).toBe("Button");
  });

  it("match composant insensible à la casse", () => {
    document.body.innerHTML = '<section data-component="HeaderBar"></section>';
    expect(searchElements("headerbar")).toHaveLength(1);
  });

  it("classe : CSS direct", () => {
    expect(toSelector(".card")).toBe(".card");
  });

  it("sélecteur CSS composé : passé tel quel", () => {
    expect(toSelector("div.card > input[type=text]")).toBe(
      "div.card > input[type=text]",
    );
  });

  it("id : CSS direct", () => {
    expect(toSelector("#main")).toBe("#main");
  });

  it("requête vide / espaces → null", () => {
    expect(toSelector("")).toBeNull();
    expect(toSelector("   ")).toBeNull();
  });

  it("échappe les caractères spéciaux d'une classe en mot libre", () => {
    expect(toSelector("a-b")).toContain(".a-b");
  });
});

describe("searchElements", () => {
  it("tag : trouve tous les éléments du tag", () => {
    document.body.innerHTML = "<div><form><input /></form></div>";
    const found = searchElements("input");
    expect(found).toHaveLength(1);
    expect(found[0]!.tagName).toBe("INPUT");
  });

  it("mot libre : tag ET classe portant le nom", () => {
    document.body.innerHTML =
      '<a class="card">1</a><a>2</a><b class="card">3</b>';
    const found = searchElements("card");
    expect(found).toHaveLength(2);
  });

  it("classe `.tag` classique", () => {
    document.body.innerHTML = '<div class="btn primary"></div>';
    expect(searchElements(".btn")).toHaveLength(1);
  });

  it("sélecteur CSS direct", () => {
    document.body.innerHTML = '<input type="text" /><input type="radio" />';
    const found = searchElements('input[type=text]');
    expect(found).toHaveLength(1);
  });

  it("exclut l'UI du picker (data-pathpicker-ignore) et ses enfants", () => {
    document.body.innerHTML =
      '<main><div class="card"></div></main>' +
      '<aside data-pathpicker-ignore=""><div class="card"></div></aside>';
    expect(searchElements(".card")).toHaveLength(1);
  });

  it("cap le nombre de résultats", async () => {
    const { SEARCH_MAX_RESULTS } = await import(
      "../../src/core/search/element-search"
    );
    const divs = Array.from(
      { length: SEARCH_MAX_RESULTS + 10 },
      () => '<i class="x">a</i>',
    ).join("");
    document.body.innerHTML = divs;
    expect(searchElements(".x")).toHaveLength(SEARCH_MAX_RESULTS);
  });

  it("vide si rien ne matche", () => {
    document.body.innerHTML = "<div></div>";
    expect(searchElements(".inexistant")).toHaveLength(0);
    expect(searchElements("table")).toHaveLength(0);
  });

  it("ne crashe pas sur un sélecteur CSS invalide", () => {
    document.body.innerHTML = "<div></div>";
    expect(searchElements("div[class")).toHaveLength(0);
  });
});

describe("pickResultFromElement", () => {
  it("construit un PickResult partiel (sans React)", () => {
    document.body.innerHTML = '<div id="app"><button class="b">ok</button></div>';
    const el = document.querySelector<HTMLElement>("button")!;
    const result = pickResultFromElement(el, "/dashboard");

    expect(result.route).toBe("/dashboard");
    expect(result.tagName).toBe("button");
    expect(result.id).toBeNull();

    expect(result.reactComponent).toBeNull();
    expect(result.reactSource).toBeNull();
    expect(result.xpath).toBe('//*[@id="app"]/button');
    expect(typeof result.cssSelector).toBe("string");
  });
});
