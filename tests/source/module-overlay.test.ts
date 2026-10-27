import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isModuleEnd,
  parseModuleStart,
  scanModuleOverlays,
} from "../../src/core/source/module-overlay";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("parseModuleStart", () => {
  it("extrait nom + durée + source d'un marqueur valide", () => {
    expect(parseModuleStart(" rp-module:blockcart:12.4:themes/t/modules/blockcart/x.tpl:3 ")).toEqual(
      { name: "blockcart", durationMs: 12.4, source: "themes/t/modules/blockcart/x.tpl:3" },
    );
  });

  it("rejette un commentaire non-marqueur", () => {
    expect(parseModuleStart(" un commentaire normal ")).toBeNull();
    expect(parseModuleStart("/rp-module")).toBeNull();
  });
});

describe("isModuleEnd", () => {
  it("reconnaît le commentaire de fermeture", () => {
    expect(isModuleEnd(" /rp-module ")).toBe(true);
    expect(isModuleEnd("rp-module:x:1:y:1")).toBe(false);
  });
});

describe("scanModuleOverlays", () => {
  it("une entrée par paire start/end, rectangle englobant des éléments encadrés", () => {
    document.body.innerHTML =
      '<!-- rp-module:blockcart:12.4:themes/t/modules/blockcart/x.tpl:3 -->' +
      "<div id=a></div><div id=b></div>" +
      "<!-- /rp-module -->";
    const a = document.getElementById("a")!;
    const b = document.getElementById("b")!;
    a.getBoundingClientRect = () => ({ left: 0, top: 0, right: 50, bottom: 20, width: 50, height: 20 }) as DOMRect;
    b.getBoundingClientRect = () => ({ left: 50, top: 0, right: 100, bottom: 20, width: 50, height: 20 }) as DOMRect;

    const entries = scanModuleOverlays(document.body);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      name: "blockcart",
      durationMs: 12.4,
      source: "themes/t/modules/blockcart/x.tpl:3",
      rect: { left: 0, top: 0, width: 100, height: 20 },
      elements: [a, b],
    });
  });

  it("ignore un module sans élément encadré (rectangle vide → pas d'entrée)", () => {
    document.body.innerHTML =
      "<!-- rp-module:empty:0.1:t/x.tpl:1 --><!-- /rp-module -->";
    expect(scanModuleOverlays(document.body)).toHaveLength(0);
  });

  it("deux modules indépendants → deux entrées distinctes", () => {
    document.body.innerHTML =
      '<!-- rp-module:a:1:t/a.tpl:1 --><div id=x></div><!-- /rp-module -->' +
      '<!-- rp-module:b:2:t/b.tpl:1 --><div id=y></div><!-- /rp-module -->';
    document.getElementById("x")!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }) as DOMRect;
    document.getElementById("y")!.getBoundingClientRect = () =>
      ({ left: 0, top: 20, right: 10, bottom: 30, width: 10, height: 10 }) as DOMRect;

    const entries = scanModuleOverlays(document.body);
    expect(entries.map((e) => e.name)).toEqual(["a", "b"]);
  });

  it("exclut un frère directement précédé du marqueur d'un autre module (hook Smarty inline)", () => {
    // Structure réaliste : le marqueur d'un module inclus en Smarty inline précède son
    // propre bloc en tant que FRÈRE (pas imbriqué dedans) — c'est ainsi que le prefilter
    // Smarty insère toujours ses marqueurs (juste avant le tag qu'il annote).
    document.body.innerHTML =
      '<!-- rp-module:tvcmscustomsetting:9:modules/tvcmscustomsetting/x.tpl:1 -->' +
      '<div id="own"></div>' +
      '<!-- rp@modules/tvcmswishlist/y.tpl:5 -->' +
      '<div id="foreign"><span>w</span></div>' +
      "<!-- /rp-module -->";
    document.getElementById("own")!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }) as DOMRect;
    document.getElementById("foreign")!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 }) as DOMRect;

    const entries = scanModuleOverlays(document.body);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.rect).toEqual({ left: 0, top: 0, width: 10, height: 10 });
  });

  it("garde un élément racine dont le marqueur propre PRÉCÈDE, même si un autre module est "
    + "inclus plus profondément à l'intérieur (ex. ps_customeraccountlinks + lien wishlist)", () => {
    document.body.innerHTML =
      '<!-- rp-module:ps_customeraccountlinks:0.1:modules/ps_customeraccountlinks/x.tpl:1 -->' +
      '<!-- rp@modules/ps_customeraccountlinks/x.tpl:26 -->' +
      '<div id="root">' +
      "  compte" +
      '  <!-- rp@modules/tvcmswishlist/y.tpl:5 -->' +
      '  <a id="wishlist-link">wishlist</a>' +
      "</div>" +
      "<!-- /rp-module -->";
    document.getElementById("root")!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 50, width: 200, height: 50 }) as DOMRect;

    const entries = scanModuleOverlays(document.body);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.elements).toEqual([document.getElementById("root")]);
    expect(entries[0]!.rect).toEqual({ left: 0, top: 0, width: 200, height: 50 });
  });

  it("rectangle en coordonnées viewport (pas document+scroll) — modules position:fixed", () => {
    vi.stubGlobal("scrollY", 300);
    vi.stubGlobal("scrollX", 50);
    document.body.innerHTML =
      '<!-- rp-module:sticky:1:t/x.tpl:1 --><div id=s></div><!-- /rp-module -->';
    document.getElementById("s")!.getBoundingClientRect = () =>
      ({ left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 }) as DOMRect;

    const entries = scanModuleOverlays(document.body);
    expect(entries[0]!.rect).toEqual({ left: 10, top: 20, width: 20, height: 20 });
  });

  it("ignore un frère largeur 0 (placeholder vide) — pas d'étirement vers lui", () => {
    document.body.innerHTML =
      '<!-- rp-module:tvcmscustomsetting:9:t/x.tpl:1 -->' +
      '<div id="empty-left"></div>' +
      '<div id="visible-right"></div>' +
      "<!-- /rp-module -->";
    document.getElementById("empty-left")!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 0, bottom: 300, width: 0, height: 300 }) as DOMRect;
    document.getElementById("visible-right")!.getBoundingClientRect = () =>
      ({ left: 100, top: 0, right: 150, bottom: 20, width: 50, height: 20 }) as DOMRect;

    const entries = scanModuleOverlays(document.body);
    expect(entries[0]!.rect).toEqual({ left: 100, top: 0, width: 50, height: 20 });
  });

  it("expose les éléments propres (hors frères d'un autre module) pour le menu contextuel", () => {
    document.body.innerHTML =
      '<!-- rp-module:hiblog:11.2:modules/hiblog/views/templates/hook/search.tpl:15 -->' +
      '<form id="own"><p>Rechercher</p></form>' +
      '<!-- rp@modules/other/y.tpl:1 -->' +
      '<div id="foreign"><span>x</span></div>' +
      "<!-- /rp-module -->";
    document.getElementById("own")!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }) as DOMRect;
    document.getElementById("foreign")!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }) as DOMRect;

    const entries = scanModuleOverlays(document.body);
    expect(entries[0]!.elements).toEqual([document.getElementById("own")]);
  });

  it("remonte au wrapper exclusif du thème (parent n'ayant que ce module comme enfant)", () => {
    // Cas réel : #contact_info_sag (footer-1.tpl) n'enveloppe rien d'autre que l'appel au
    // hook ps_contactinfo — le rectangle doit coller à ce conteneur, pas seulement à la
    // racine stricte du module (.tvfooter-contact-link-wrapper).
    document.body.innerHTML =
      '<div id="contact_info_sag">' +
      '<!-- rp-module:ps_contactinfo:9:t/x.tpl:1 -->' +
      '<div id="inner"></div>' +
      "<!-- /rp-module -->" +
      "</div>";
    document.getElementById("inner")!.getBoundingClientRect = () =>
      ({ left: 5, top: 5, right: 50, bottom: 50, width: 45, height: 45 }) as DOMRect;
    document.getElementById("contact_info_sag")!.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }) as DOMRect;

    const entries = scanModuleOverlays(document.body);
    expect(entries[0]!.elements).toEqual([document.getElementById("contact_info_sag")]);
    expect(entries[0]!.rect).toEqual({ left: 0, top: 0, width: 100, height: 100 });
  });

  it("ne remonte pas si le parent a d'autres enfants (évite d'engloutir un frère étranger)", () => {
    document.body.innerHTML =
      '<div id="wrap">' +
      '<!-- rp-module:a:1:t/a.tpl:1 -->' +
      '<div id="inner"></div>' +
      "<!-- /rp-module -->" +
      '<div id="sibling-outside-module"></div>' +
      "</div>";
    document.getElementById("inner")!.getBoundingClientRect = () =>
      ({ left: 5, top: 5, right: 20, bottom: 20, width: 15, height: 15 }) as DOMRect;

    const entries = scanModuleOverlays(document.body);
    expect(entries[0]!.elements).toEqual([document.getElementById("inner")]);
  });
});
