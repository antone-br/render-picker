import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildVscodeUri, initClickToSource } from "../../src/core/dev/click-to-source";
import { DEFAULT_SETTINGS } from "../../src/core/settings";

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

/** Laisse se résoudre l'appel à la route (rejeté ici) puis le repli sur le lien. */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("initClickToSource", () => {
  let stop: () => void = () => {};

  // Route dev absente par défaut → repli sur le lien d'URL.
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no route"))));
  });

  afterEach(() => {
    stop();
    stop = () => {};
    document.body.innerHTML = "";
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("Alt+clic sur [data-source] → ouvre VS Code + désarme (Escape)", async () => {
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
        altKey: true,
        button: 0,
        bubbles: true,
      }),
    );
    await flush();

    document.removeEventListener("keydown", onKey);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(escape).toBe(true);
  });

  it("Ctrl+clic → ouvre data-owner-source (fichier d'usage), pas data-source", async () => {
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
      new MouseEvent("pointerdown", { ctrlKey: true, button: 0, bubbles: true }),
    );
    await flush();

    expect(href).toContain("src/features/kanban.tsx:12");
    expect(href).not.toContain("button.tsx");
  });

  it("Ctrl+clic sans data-owner-source → fallback data-source", async () => {
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
      new MouseEvent("pointerdown", { ctrlKey: true, button: 0, bubbles: true }),
    );
    await flush();

    expect(href).toContain("src/a.tsx:3");
  });

  it("clic normal (sans Alt) → n'ouvre rien", async () => {
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
    await flush();

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("binding remappé : source = Cmd+clic → Cmd ouvre, Ctrl n'ouvre plus", async () => {
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ commands: { source: { modifier: "meta", trigger: "click" } } }),
    );
    const el = document.createElement("div");
    el.setAttribute("data-source", "src/a.tsx:3");
    document.body.appendChild(el);

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    stop = initClickToSource("C:/proj");

    // Ctrl matche le binding usage (defaut : ctrl+clic).
    el.dispatchEvent(
      new MouseEvent("pointerdown", { ctrlKey: true, button: 0, bubbles: true }),
    );
    await flush();
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Cmd (meta) matche la source remappée.
    el.dispatchEvent(
      new MouseEvent("pointerdown", { metaKey: true, button: 0, bubbles: true }),
    );
    await flush();
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it("trigger rightclick : usage = Alt+clic droit → contextmenu ouvre l'usage", async () => {
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ commands: { usage: { modifier: "alt", trigger: "rightclick" } } }),
    );
    const el = document.createElement("div");
    el.setAttribute("data-source", "src/a.tsx:3");
    el.setAttribute("data-owner-source", "src/usage.tsx:9");
    document.body.appendChild(el);

    let href = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        href = this.href;
      },
    );

    stop = initClickToSource("C:/proj");
    el.dispatchEvent(
      new MouseEvent("contextmenu", { altKey: true, button: 2, bubbles: true }),
    );
    await flush();

    expect(href).toContain("src/usage.tsx:9");
  });

  it("éditeur choisi (commands.editor) → URI de cet éditeur (WebStorm)", async () => {
    const el = document.createElement("div");
    el.setAttribute("data-source", "src/a.tsx:3");
    document.body.appendChild(el);

    let href = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        href = this.href;
      },
    );

    stop = initClickToSource("C:/proj", () => ({
      ...DEFAULT_SETTINGS.commands,
      editor: "webstorm",
    }));
    el.dispatchEvent(
      new MouseEvent("pointerdown", { altKey: true, button: 0, bubbles: true }),
    );
    await flush();

    expect(href).toBe(`webstorm://open?file=${encodeURIComponent("C:/proj/src/a.tsx")}&line=3`);
  });

  it("route dev OK → le serveur ouvre l'IDE, pas de lien d'URL", async () => {
    const el = document.createElement("div");
    el.setAttribute("data-source", "src/a.tsx:3");
    document.body.appendChild(el);
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{"ok":true}', { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    stop = initClickToSource("C:/proj", () => ({
      ...DEFAULT_SETTINGS.commands,
      editor: "phpstorm",
    }));
    el.dispatchEvent(
      new MouseEvent("pointerdown", { altKey: true, button: 0, bubbles: true }),
    );
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/render-picker");
    expect(JSON.parse(init.body as string)).toEqual({
      open: { editor: "phpstorm", source: "src/a.tsx:3" },
    });
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("route dev en erreur (IDE introuvable) → repli sur le lien d'URL", async () => {
    const el = document.createElement("div");
    el.setAttribute("data-source", "src/a.tsx:3");
    document.body.appendChild(el);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response('{"error":"editor not found"}', { status: 500 }))),
    );
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    stop = initClickToSource("C:/proj");
    el.dispatchEvent(
      new MouseEvent("pointerdown", { altKey: true, button: 0, bubbles: true }),
    );
    await flush();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
