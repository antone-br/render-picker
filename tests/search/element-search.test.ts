import { afterEach, describe, expect, it } from "vitest";

import {
  groupResults,
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

  it("autocomplétion `div.` : tous les div du DOM", () => {
    document.body.innerHTML =
      '<div class="a"></div><div class="b"></div><span></span>';
    const found = searchElements("div.");
    expect(found).toHaveLength(2);
  });

  it("autocomplétion `div.car` : préfixe de classe (casse ignorée)", () => {
    document.body.innerHTML =
      '<div class="card main"></div><div class="cart"></div>' +
      '<div class="foot"></div><section class="card"></section>';
    const keys = groupResults(searchElements("div.car")).map((g) => g.key);
    expect(keys).toContain("div.card.main");
    expect(keys).toContain("div.cart");
    expect(keys.every((k) => k.startsWith("div.card") || k.startsWith("div.cart"))).toBe(
      true,
    );
  });

  it("autocomplétion `.car` sans tag : scan global", () => {
    document.body.innerHTML =
      '<div class="card"></div><section class="cart"></section><p></p>';
    expect(searchElements(".car")).toHaveLength(2);
  });

  it("autocomplétion exclut l'UI+hôte et respecte le cap", () => {
    document.body.innerHTML =
      '<div class="x"></div><aside data-pathpicker-ignore=""><div class="x"></div></aside>';
    expect(searchElements("div.")).toHaveLength(1);
  });
});

describe("groupResults", () => {
  it("regroupe par tag + classes (3 max), compte les occurrences", () => {
    document.body.innerHTML =
      '<button class="btn primary">1</button>' +
      '<button class="btn primary">2</button>' +
      "<button>3</button>" +
      '<input type="text" />';
    const groups = groupResults(searchElements("button, input"));

    // Tri croissant par longueur de classe : nu → court → composé.
    expect(groups.map((g) => g.key)).toEqual([
      "button",
      "input",
      "button.btn.primary",
    ]);
    expect(groups[0]!.count).toBe(1);
    expect(groups[2]!.count).toBe(2);
    expect(groups[2]!.indices).toEqual([0, 1]);
    expect(groups[0]!.indices).toEqual([2]);
  });

  it("vide pour une liste vide", () => {
    expect(groupResults([])).toEqual([]);
  });

  it("sélecteur échappé pour les tokens Tailwind (`:`) — round-trip clic→recherche", () => {
    document.body.innerHTML =
      '<div class="h-full px-4 md:px-6">1</div>' +
      '<div class="h-full px-4 md:px-6">2</div>';
    const groups = groupResults(searchElements("div"));

    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe("div.h-full.px-4.md:px-6"); // affichage brut
    expect(groups[0]!.selector).toBe("div.h-full.px-4.md\\:px-6"); // CSS valide

    const again = searchElements(groups[0]!.selector);
    expect(again).toHaveLength(2);
  });

  it("tokens valides (h-full) : sélecteur identique au brut", () => {
    document.body.innerHTML = '<button class="h-full">1</button>';
    const groups = groupResults(searchElements("button"));
    expect(groups[0]!.selector).toBe("button.h-full");
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
