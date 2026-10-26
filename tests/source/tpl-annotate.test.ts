import { afterEach, describe, expect, it, vi } from "vitest";

import {
  annotateFromComments,
  initTplAnnotator,
  moduleNameFromSource,
  parseTplMarker,
  tplLabel,
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

  it("seed : annote la racine + enfants d'un sous-arbre sans marqueur local", () => {
    document.body.innerHTML = "<section><span>x</span></section>";
    const sub = document.querySelector("section")!;
    // Amorce (comme pour un sous-arbre ajouté précédé d'un marqueur rp@t/b.tpl:7).
    const count = annotateFromComments(sub, "t/b.tpl:7", "b.tpl");
    expect(sub.getAttribute("data-source")).toBe("t/b.tpl:7");
    expect(sub.getAttribute("data-component")).toBe("b.tpl");
    expect(document.querySelector("span")!.getAttribute("data-source")).toBe("t/b.tpl:7");
    expect(count).toBe(2);
  });
});

describe("moduleNameFromSource", () => {
  it("extrait le nom du module", () => {
    expect(moduleNameFromSource("modules/tvcmscategoryproduct/views/x.tpl")).toBe(
      "tvcmscategoryproduct",
    );
  });
  it("null hors d'un module", () => {
    expect(moduleNameFromSource("themes/t/templates/catalog/product.tpl")).toBeNull();
    expect(moduleNameFromSource("src/components/x.tsx")).toBeNull();
  });
});

describe("tplLabel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("nom du module pour un .tpl de module (ignore :ligne)", () => {
    document.body.innerHTML =
      '<div data-source="modules/tvcmscategoryproduct/views/templates/front/x.tpl:53"><span>y</span></div>';
    expect(tplLabel(document.querySelector("span")!)).toBe("tvcmscategoryproduct");
  });

  it("basename pour un .tpl de thème", () => {
    document.body.innerHTML = '<div data-source="themes/t/templates/catalog/product.tpl:12"></div>';
    expect(tplLabel(document.querySelector("div")!)).toBe("product.tpl");
  });

  it("null pour une source non-.tpl (React) ou sans data-source", () => {
    document.body.innerHTML = '<div data-source="src/components/button.tsx:178"></div><p></p>';
    expect(tplLabel(document.querySelector("div")!)).toBeNull();
    expect(tplLabel(document.querySelector("p")!)).toBeNull();
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

  it("annote un sous-arbre ajouté après coup (incrémental, via marqueur précédent)", async () => {
    document.body.innerHTML = "<!-- rp@t/a.tpl:1 --><div id=root></div>";
    const dispose = initTplAnnotator();
    const container = document.getElementById("root")!;
    // Nouveau contenu dynamique, précédé de son propre marqueur.
    container.insertAdjacentHTML("beforebegin", "<!-- rp@t/dyn.tpl:9 -->");
    const added = document.createElement("article");
    added.innerHTML = "<span>y</span>";
    container.before(added);

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    expect(added.getAttribute("data-source")).toBe("t/dyn.tpl:9");
    expect(added.querySelector("span")!.getAttribute("data-source")).toBe("t/dyn.tpl:9");
    dispose();
  });
});
