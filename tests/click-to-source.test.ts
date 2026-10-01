import { describe, expect, it } from "vitest";

import { buildVscodeUri } from "../src/core/click-to-source";

describe("buildVscodeUri", () => {
  it("construit l'URI VS Code depuis une racine Windows (backslashes)", () => {
    expect(
      buildVscodeUri(
        "C:\\Users\\anton\\Documents\\vs-code\\renderflow",
        "src/features/(dashboard)/comments/kanban/components/header-bar.tsx:160",
      ),
    ).toBe(
      "vscode://file/C:/Users/anton/Documents/vs-code/renderflow/src/features/(dashboard)/comments/kanban/components/header-bar.tsx:160",
    );
  });

  it("retire le slash final de la racine (pas de double slash)", () => {
    expect(buildVscodeUri("/home/user/app/", "src/app/page.tsx:1")).toBe(
      "vscode://file//home/user/app/src/app/page.tsx:1",
    );
  });

  it("accepte une racine déjà en forward-slash", () => {
    expect(buildVscodeUri("C:/proj", "src/a.tsx:42")).toBe(
      "vscode://file/C:/proj/src/a.tsx:42",
    );
  });

  it("retire un slash de tête superflu dans le source", () => {
    expect(buildVscodeUri("C:/proj", "/src/a.tsx:42")).toBe(
      "vscode://file/C:/proj/src/a.tsx:42",
    );
  });

  it("retourne null si source absent/vide", () => {
    expect(buildVscodeUri("C:/proj", null)).toBeNull();
    expect(buildVscodeUri("C:/proj", "")).toBeNull();
  });

  it("retourne null si racine absente/vide", () => {
    expect(buildVscodeUri(undefined, "src/a.tsx:1")).toBeNull();
    expect(buildVscodeUri("", "src/a.tsx:1")).toBeNull();
    expect(buildVscodeUri("/", "src/a.tsx:1")).toBeNull();
  });
});
