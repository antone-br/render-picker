import { afterEach, describe, expect, it, vi } from "vitest";

// Map url de chunk → position résolue (source:line).
const MAP: Record<string, { source: string; line: number; column: number }> = {
  "https://x/_next/static/chunks/button._.js": {
    source: "src/components/ui/display/button.tsx",
    line: 178,
    column: 1,
  },
  "https://x/_next/static/chunks/feature._.js": {
    source: "src/features/comments/card.tsx",
    line: 56,
    column: 1,
  },
};

vi.mock("../../src/core/source/source-map-resolver", () => ({
  resolvePosition: async (url: string) => MAP[url] ?? null,
}));

import { annotate, extractDirectSources } from "../../src/core/source/component-annotate";

afterEach(() => {
  document.body.innerHTML = "";
});

/** Frame nommée `at Comp (url:l:c)`. */
function frame(url: string): string {
  return `    at Comp (${url}:178:1)`;
}

/** Frame anonyme `at url:l:c` (callback arrow sans nom, comme V8). */
function anonFrame(url: string): string {
  return `    at ${url}:56:3`;
}

/** Élément avec une fiber host (+ owner) attachée via la clé `__reactFiber$…`. */
function elWithFiber(
  hostUrl: string,
  ownerStack?: string,
): HTMLElement {
  const el = document.createElement("button");
  const owner = ownerStack
    ? {
        type: function Button() {},
        return: null,
        _debugOwner: null,
        _debugStack: { stack: ownerStack },
      }
    : null;
  const host = {
    type: "button",
    return: null,
    _debugOwner: owner,
    _debugStack: { stack: frame(hostUrl) },
  };
  (el as unknown as Record<string, unknown>)["__reactFiber$test"] = host;
  document.body.appendChild(el);
  return el;
}

describe("annotate — data-source / data-owner-source", () => {
  it("owner = fichier d'usage (via _debugOwner), ≠ module du composant", async () => {
    const el = elWithFiber(
      "https://x/_next/static/chunks/button._.js",
      frame("https://x/_next/static/chunks/feature._.js"),
    );
    annotate(el);

    await vi.waitFor(() => {
      expect(el.getAttribute("data-owner-source")).toBe(
        "src/features/comments/card.tsx:56",
      );
    });
    expect(el.getAttribute("data-source")).toBe(
      "src/components/ui/display/button.tsx:178",
    );
  });

  it("pas de data-owner-source si owner dans le même fichier", async () => {
    // owner résolu sur le même chunk (même fichier) → ignoré, pas d'usage distinct.
    const el = elWithFiber(
      "https://x/_next/static/chunks/button._.js",
      frame("https://x/_next/static/chunks/button._.js"),
    );
    annotate(el);

    await vi.waitFor(() => {
      expect(el.getAttribute("data-source")).toBe(
        "src/components/ui/display/button.tsx:178",
      );
    });
    expect(el.getAttribute("data-owner-source")).toBeNull();
  });

  it("owner via frame anonyme (callback arrow, sans nom) — résolu quand même", async () => {
    // `<Tag/>` créé dans `allUsers.map((u) => …)` : V8 émet `at <url>:l:c`
    // sans `nom (…)`. Doit matcher, sinon on retombe sur la fonction englobante.
    const el = elWithFiber(
      "https://x/_next/static/chunks/button._.js",
      anonFrame("https://x/_next/static/chunks/feature._.js"),
    );
    annotate(el);

    await vi.waitFor(() => {
      expect(el.getAttribute("data-owner-source")).toBe(
        "src/features/comments/card.tsx:56",
      );
    });
  });

  it("Webpack dev : data-source depuis la frame (sans sourcemap)", async () => {
    // Pas de chunk `._.js` → le resolver sourcemap (mocké) ne sert pas ;
    // le chemin source vient directement de la frame webpack-internal.
    const el = document.createElement("button");
    const host = {
      type: "button",
      return: null,
      _debugOwner: { type: function Comp() {}, return: null, _debugOwner: null },
      _debugStack: {
        stack:
          "    at Comp (webpack-internal:///(app-pages-browser)/./src/components/x.tsx:12:5)",
      },
    };
    (el as unknown as Record<string, unknown>)["__reactFiber$test"] = host;
    document.body.appendChild(el);
    annotate(el);

    await vi.waitFor(() => {
      expect(el.getAttribute("data-source")).toBe("src/components/x.tsx:12");
    });
  });
});

describe("extractDirectSources (frames Webpack dev)", () => {
  it("extrait source + ligne d'une frame webpack-internal", () => {
    const out = extractDirectSources(
      "at Comp (webpack-internal:///(app-pages-browser)/./src/components/x.tsx:12:5)",
    );
    expect(out).toEqual([{ source: "src/components/x.tsx", line: 12 }]);
  });

  it("frame serveur RSC : route group (parenthèses) + query ?id", () => {
    const out = extractDirectSources(
      "at HtmlToWebflow (about://React/Server/webpack-internal:///(rsc)/./src/features/(marketing)/components/sections/html-to-webflow.tsx?855:32:87)",
    );
    expect(out).toEqual([
      { source: "src/features/(marketing)/components/sections/html-to-webflow.tsx", line: 32 },
    ]);
  });

  it("normalise les backslashes et les chemins à crochets", () => {
    const out = extractDirectSources("at LocaleLayout (src\\app\\[locale]\\layout.tsx:83:11)");
    expect(out).toEqual([{ source: "src/app/[locale]/layout.tsx", line: 83 }]);
  });

  it("ignore les frames node_modules (pas de préfixe src/ ou app/)", () => {
    const out = extractDirectSources(
      "at X (webpack-internal:///(app-pages-browser)/./node_modules/@antone-br/render-picker/dist/chunk.js:1:1)",
    );
    expect(out).toEqual([]);
  });

  it("préserve l'ordre (1re frame source = site de création)", () => {
    const out = extractDirectSources(
      [
        "at a (webpack-internal:///(app-pages-browser)/./src/a.tsx:1:1)",
        "at b (webpack-internal:///(app-pages-browser)/./src/b.tsx:2:2)",
      ].join("\n"),
    );
    expect(out.map((f) => f.source)).toEqual(["src/a.tsx", "src/b.tsx"]);
  });
});
