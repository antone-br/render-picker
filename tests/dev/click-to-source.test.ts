import { afterEach, describe, expect, it, vi } from "vitest";

import { buildVscodeUri, initClickToSource } from "../../src/core/dev/click-to-source";

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

describe("initClickToSource", () => {
  let stop: () => void = () => {};

  afterEach(() => {
    stop();
    stop = () => {};
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("Ctrl+clic sur [data-source] → ouvre VS Code + désarme (Escape)", () => {
    const el = document.createElement("div");
    el.setAttribute("data-source", "src/a.tsx:3");
    document.body.appendChild(el);

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    let escape = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") escape = true;
    };
    document.addEventListener("keydown", onKey);

    stop = initClickToSource("C:/proj");
    el.dispatchEvent(
      new MouseEvent("pointerdown", {
        ctrlKey: true,
        button: 0,
        bubbles: true,
      }),
    );

    document.removeEventListener("keydown", onKey);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(escape).toBe(true);
  });

  it("Alt+clic → ouvre data-owner-source (fichier d'usage), pas data-source", () => {
    const el = document.createElement("div");
    el.setAttribute("data-source", "src/components/button.tsx:178");
    el.setAttribute("data-owner-source", "src/features/kanban.tsx:12");
    document.body.appendChild(el);

    let href = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        href = this.href;
      },
    );

    stop = initClickToSource("C:/proj");
    el.dispatchEvent(
      new MouseEvent("pointerdown", { altKey: true, button: 0, bubbles: true }),
    );

    expect(href).toContain("src/features/kanban.tsx:12");
    expect(href).not.toContain("button.tsx");
  });

  it("Alt+clic sans data-owner-source → fallback data-source", () => {
    const el = document.createElement("div");
    el.setAttribute("data-source", "src/a.tsx:3");
    document.body.appendChild(el);

    let href = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        href = this.href;
      },
    );

    stop = initClickToSource("C:/proj");
    el.dispatchEvent(
      new MouseEvent("pointerdown", { altKey: true, button: 0, bubbles: true }),
    );

    expect(href).toContain("src/a.tsx:3");
  });

  it("clic normal (sans Ctrl) → n'ouvre rien", () => {
    const el = document.createElement("div");
    el.setAttribute("data-source", "src/a.tsx:3");
    document.body.appendChild(el);

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    stop = initClickToSource("C:/proj");
    el.dispatchEvent(
      new MouseEvent("pointerdown", { button: 0, bubbles: true }),
    );

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
