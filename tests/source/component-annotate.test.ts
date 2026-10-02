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

import { annotate } from "../../src/core/source/component-annotate";

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
});
