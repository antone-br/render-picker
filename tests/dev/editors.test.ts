import { describe, expect, it } from "vitest";

import { buildEditorUri, EDITORS, isEditorId } from "../../src/core/dev/editors";

describe("EDITORS", () => {
  it("10 éditeurs, ids uniques, libellés non vides", () => {
    expect(EDITORS).toHaveLength(10);
    expect(new Set(EDITORS.map((e) => e.id)).size).toBe(10);
    for (const e of EDITORS) expect(e.label.length).toBeGreaterThan(0);
  });

  it("isEditorId : ids connus seulement", () => {
    expect(isEditorId("webstorm")).toBe(true);
    expect(isEditorId("notepad")).toBe(false);
    expect(isEditorId(undefined)).toBe(false);
  });
});

describe("buildEditorUri", () => {
  const root = "C:\\proj\\";
  const src = "src/a.tsx:42";

  it("famille VS Code : <scheme>://file/<abs>:<ligne>", () => {
    expect(buildEditorUri("vscode", root, src)).toBe("vscode://file/C:/proj/src/a.tsx:42");
    expect(buildEditorUri("vscode-insiders", root, src)).toBe(
      "vscode-insiders://file/C:/proj/src/a.tsx:42",
    );
    expect(buildEditorUri("cursor", root, src)).toBe("cursor://file/C:/proj/src/a.tsx:42");
    expect(buildEditorUri("windsurf", root, src)).toBe("windsurf://file/C:/proj/src/a.tsx:42");
    expect(buildEditorUri("vscodium", root, src)).toBe("vscodium://file/C:/proj/src/a.tsx:42");
  });

  it("famille VS Code : colonne conservée", () => {
    expect(buildEditorUri("cursor", "C:/proj", "src/a.tsx:42:7")).toBe(
      "cursor://file/C:/proj/src/a.tsx:42:7",
    );
  });

  it("Zed : zed://file/<abs>:<ligne>:<col>, sans double slash en posix", () => {
    expect(buildEditorUri("zed", "/home/u/app", "src/a.tsx:42:7")).toBe(
      "zed://file/home/u/app/src/a.tsx:42:7",
    );
    expect(buildEditorUri("zed", root, src)).toBe("zed://file/C:/proj/src/a.tsx:42");
  });

  it("JetBrains : <scheme>://open?file=<abs encodé>&line=…(&column=…)", () => {
    expect(buildEditorUri("webstorm", root, src)).toBe(
      `webstorm://open?file=${encodeURIComponent("C:/proj/src/a.tsx")}&line=42`,
    );
    expect(buildEditorUri("phpstorm", "/home/u/app", "src/b.tsx:3:9")).toBe(
      `phpstorm://open?file=${encodeURIComponent("/home/u/app/src/b.tsx")}&line=3&column=9`,
    );
    expect(buildEditorUri("idea", root, src)?.startsWith("idea://open?file=")).toBe(true);
    expect(buildEditorUri("pycharm", root, src)?.startsWith("pycharm://open?file=")).toBe(true);
  });

  it("JetBrains : chemin avec espaces / parenthèses encodé", () => {
    const uri = buildEditorUri("webstorm", "C:/my proj", "src/(dash)/a.tsx:1")!;
    expect(uri).toBe(
      `webstorm://open?file=${encodeURIComponent("C:/my proj/src/(dash)/a.tsx")}&line=1`,
    );
  });

  it("sans ligne : fichier seul", () => {
    expect(buildEditorUri("vscode", "C:/proj", "src/a.tsx")).toBe("vscode://file/C:/proj/src/a.tsx");
    expect(buildEditorUri("webstorm", "C:/proj", "src/a.tsx")).toBe(
      `webstorm://open?file=${encodeURIComponent("C:/proj/src/a.tsx")}`,
    );
  });

  it("slash initial de la source ignoré", () => {
    expect(buildEditorUri("cursor", "C:/proj", "/src/a.tsx:42")).toBe(
      "cursor://file/C:/proj/src/a.tsx:42",
    );
  });

  it("racine ou source absente → null", () => {
    expect(buildEditorUri("webstorm", "C:/proj", null)).toBeNull();
    expect(buildEditorUri("webstorm", "C:/proj", "")).toBeNull();
    expect(buildEditorUri("webstorm", undefined, "src/a.tsx:1")).toBeNull();
    expect(buildEditorUri("webstorm", "/", "src/a.tsx:1")).toBeNull();
  });
});
