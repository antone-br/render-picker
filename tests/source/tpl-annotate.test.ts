import { afterEach, describe, expect, it, vi } from "vitest";

import {
  annotateFromComments,
  initTplAnnotator,
  parseTplMarker,
} from "../../src/core/source/tpl-annotate";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("parseTplMarker", () => {
  it("extrait source + ligne d'un marqueur valide", () => {
    expect(parseTplMarker(" rp@themes/x/foo.tpl:42 ")).toEqual({
      source: "themes/x/foo.tpl",
      line: 42,
    });
  });

  it("gère les parenthèses et crochets dans le chemin", () => {
    expect(parseTplMarker("rp@modules/ps_(x)/[a]/b.tpl:7")).toEqual({
      source: "modules/ps_(x)/[a]/b.tpl",
      line: 7,
    });
  });

  it("rejette un commentaire non-marqueur", () => {
    expect(parseTplMarker(" un commentaire normal ")).toBeNull();
    expect(parseTplMarker("rp@foo.tpl")).toBeNull(); // pas de ligne
  });
});

describe("annotateFromComments", () => {
  it("pose data-source / data-component selon le marqueur précédent", () => {
    document.body.innerHTML =
      "<!-- rp@themes/t/page.tpl:10 --><div><span>x</span></div>";
    const count = annotateFromComments(document.body);

    const div = document.querySelector("div")!;
    expect(div.getAttribute("data-source")).toBe("themes/t/page.tpl:10");
    expect(div.getAttribute("data-component")).toBe("page.tpl");
    // Le span hérite du même marqueur (aucun marqueur plus proche).
    expect(document.querySelector("span")!.getAttribute("data-source")).toBe(
      "themes/t/page.tpl:10",
    );
    expect(count).toBe(2);
  });

  it("l'enfant prend son propre marqueur (plus proche en ordre document)", () => {
    document.body.innerHTML =
      "<!-- rp@t/a.tpl:1 --><div><!-- rp@t/a.tpl:2 --><span>x</span></div>";
    annotateFromComments(document.body);
    expect(document.querySelector("div")!.getAttribute("data-source")).toBe("t/a.tpl:1");
    expect(document.querySelector("span")!.getAttribute("data-source")).toBe("t/a.tpl:2");
  });

  it("élément sans marqueur précédent → aucun data-source", () => {
    document.body.innerHTML = "<div>x</div>";
    annotateFromComments(document.body);
    expect(document.querySelector("div")!.hasAttribute("data-source")).toBe(false);
  });

  it("idempotent : ne réécrit pas un élément déjà annoté", () => {
    document.body.innerHTML = "<!-- rp@t/a.tpl:5 --><div>x</div>";
    expect(annotateFromComments(document.body)).toBe(1);
    expect(annotateFromComments(document.body)).toBe(0);
  });
});

describe("initTplAnnotator", () => {
  it("annote au démarrage puis se démonte proprement (observer déconnecté)", () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    document.body.innerHTML = "<!-- rp@t/a.tpl:3 --><p>x</p>";
    const dispose = initTplAnnotator();
    expect(document.querySelector("p")!.getAttribute("data-source")).toBe("t/a.tpl:3");
    dispose();
    expect(disconnect).toHaveBeenCalled();
  });
});
