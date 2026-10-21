import { afterEach, describe, expect, it, vi } from "vitest";

import {
  normalizeSourcePath,
  resolvePosition,
} from "../../src/core/source/source-map-resolver";

describe("normalizeSourcePath", () => {
  it("extrait le chemin relatif src/ d'une URL Turbopack", () => {
    expect(
      normalizeSourcePath(
        "turbopack:///[project]/src/components/button.tsx",
      ),
    ).toBe("src/components/button.tsx");
  });

  it("gère les backslashes Windows", () => {
    expect(normalizeSourcePath("C:\\proj\\app\\page.tsx")).toBe(
      "app/page.tsx",
    );
  });

  it("renvoie le chemin normalisé si aucun src/app", () => {
    expect(normalizeSourcePath("lib\\x.ts")).toBe("lib/x.ts");
  });
});

// Mapping "AAAA;AACA" : ligne 1 col 0 → source 0 ligne 0 col 0, ligne 2 → ligne 1.
const MAP = {
  version: 3,
  sources: ["webpack:///src/app/page.tsx"],
  mappings: "AAAA;AACA",
};

function mockFetch(responses: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = responses[url];
      if (body === undefined) return { ok: false };
      return {
        ok: true,
        text: async () => body as string,
        json: async () => body,
      };
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as Record<string, unknown>)
    .__rfComponentTraceChunkCache__;
});

describe("resolvePosition", () => {
  it("résout via une sourcemap plain", async () => {
    const chunk = "http://localhost:3000/_next/static/chunks/a._.js";
    mockFetch({
      [chunk]: "code\n//# sourceMappingURL=a._.js.map",
      "http://localhost:3000/_next/static/chunks/a._.js.map": MAP,
    });
    expect(await resolvePosition(chunk, 2, 0)).toEqual({
      source: "src/app/page.tsx",
      line: 2,
      column: 0,
    });
  });

  it("résout via une index map (sections)", async () => {
    const chunk = "http://localhost:3000/_next/static/chunks/b._.js";
    mockFetch({
      [chunk]: "code\n//# sourceMappingURL=b._.js.map",
      "http://localhost:3000/_next/static/chunks/b._.js.map": {
        version: 3,
        sections: [{ offset: { line: 10, column: 0 }, map: MAP }],
      },
    });
    expect(await resolvePosition(chunk, 12, 0)).toEqual({
      source: "src/app/page.tsx",
      line: 2,
      column: 0,
    });
  });

  it("null si le chunk n'annonce pas de sourcemap", async () => {
    const chunk = "http://localhost:3000/_next/static/chunks/c._.js";
    mockFetch({ [chunk]: "code" });
    expect(await resolvePosition(chunk, 1, 0)).toBeNull();
  });

  it("trou de mapping : ligne déclaration/interface → prochain mapping code du même fichier", async () => {
    // Généré (1 ligne) : segment 0 → interface (ligne 7, non-code), segment 50 → jsx (ligne 19).
    // VLQ : [0,0]=src0:6:0 ; [50,+12]=src0:18:0 → deltas col +50, line +12.
    const chunk = "http://localhost:3000/_next/static/chunks/d._.js";
    mockFetch({
      [chunk]: "code\n//# sourceMappingURL=d._.js.map",
      "http://localhost:3000/_next/static/chunks/d._.js.map": {
        version: 3,
        sources: ["webpack:///src/features/home/components/expertise-cards.tsx"],
        sourcesContent: [
          '"use client";\n\nimport type { FC } from "react";\n\nimport { Inter } from "@/components/typography/inter";\n\ninterface ExpertiseItem {\n  name: string;\n  description: string;\n}\n\ninterface ExpertiseCardsProps {\n  items: ExpertiseItem[];\n}\n\nexport const ExpertiseCards = ({ items }) => (\n  <ul>\n    {items.map((x) => (\n      <li className="expertise-item">x</li>\n    ))}\n  </ul>\n);',
        ],
        mappings: "AAMA,kDAYA",
      },
    });
    // Colonne 10 : hérite du segment interface (ligne 7) → saute vers le
    // prochain mapping du même fichier (ligne 19).
    expect(await resolvePosition(chunk, 1, 10)).toEqual({
      source: "src/features/home/components/expertise-cards.tsx",
      line: 19,
      column: 0,
    });
    // Colonne 0 : sur le segment interface lui-même → non-code → saute aussi.
    expect(await resolvePosition(chunk, 1, 0)).toEqual({
      source: "src/features/home/components/expertise-cards.tsx",
      line: 19,
      column: 0,
    });
  });

  it("pas de sourcesContent → comportement standard (héritage brut)", async () => {
    const chunk = "http://localhost:3000/_next/static/chunks/e._.js";
    mockFetch({
      [chunk]: "code\n//# sourceMappingURL=e._.js.map",
      "http://localhost:3000/_next/static/chunks/e._.js.map": MAP,
    });
    expect(await resolvePosition(chunk, 2, 0)).toEqual({
      source: "src/app/page.tsx",
      line: 2,
      column: 0,
    });
  });
});
