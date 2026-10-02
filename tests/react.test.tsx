import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InspectorCallbacks } from "../src/core/types";

// Capture les callbacks passés à l'inspecteur pour les déclencher à la main.
let captured: InspectorCallbacks | null = null;
vi.mock("../src/core/inspector/inspector", () => ({
  createInspector: (cb: InspectorCallbacks) => {
    captured = cb;
    return { activate: () => {}, deactivate: () => {}, refreshDecorations: () => {} };
  },
}));

import { RenderPickerButton, formatResult, formatResults } from "../src/react";
import type { PickResult } from "../src/core/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const result: PickResult = {
  route: "/",
  xpath: "/html/body/main",
  cssSelector: "main",
  tagName: "main",
  id: null,
  reactComponent: "Page",
  reactSource: "src/app/page.tsx:10",
};

afterEach(() => {
  document.body.innerHTML = "";
  captured = null;
  vi.restoreAllMocks();
});

describe("formatResult / formatResults", () => {
  it("multi-ligne, sans Origin/Project, Source séparé, React en dernier", () => {
    expect(formatResult(result)).toBe(
      [
        "[renderPicker]",
        "Route: /",
        "XPath: /html/body/main",
        "CSS: main",
        "Source: src/app/page.tsx:10",
        "React: Page",
      ].join("\n"),
    );
  });

  it("omet Origin et Project", () => {
    const text = formatResult(result);
    expect(text).not.toContain("Origin");
    expect(text).not.toContain("Project");
  });

  it("React (composant) est la dernière ligne", () => {
    expect(formatResult(result).trim().endsWith("React: Page")).toBe(true);
  });

  it("sans source → pas de ligne Source, React quand même en dernier", () => {
    const text = formatResult({ ...result, reactSource: null });
    expect(text).not.toContain("Source:");
    expect(text.trim().endsWith("React: Page")).toBe(true);
  });

  it("multi : en-tête + Route partagée + un bloc par élément", () => {
    const text = formatResults([result, { ...result, xpath: "/html/body/nav" }]);
    expect(text.startsWith("[renderPicker] 2 elements\nRoute: /")).toBe(true);
    expect(text).toContain("#1");
    expect(text).toContain("#2");
    expect(text).toContain("XPath: /html/body/nav");
    expect(text).not.toContain("Origin");
  });
});

describe("RenderPickerButton", () => {
  it("rend un bouton accessible, data-pathpicker-ignore, et s'arme au clic", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    const btn = document.querySelector<HTMLButtonElement>(
      "button[aria-label^='renderPicker']",
    );
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("data-pathpicker-ignore")).not.toBeNull();

    act(() => btn?.click());
    // Armé → l'inspecteur est monté (callbacks capturés) + barre du bas affichée.
    expect(captured).not.toBeNull();
    expect(document.body.textContent).toContain("Échap pour annuler");

    act(() => root.unmount());
  });

  it("l'icône paramètre ouvre le dropdown avec les 2 toggles", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    const btn = document.querySelector<HTMLButtonElement>(
      "button[aria-label^='renderPicker']",
    );
    act(() => btn?.click());

    const gear = document.querySelector<HTMLButtonElement>("button[data-rp-gear]");
    expect(gear).not.toBeNull();
    act(() => gear?.click());

    expect(document.body.textContent).toContain("Afficher le padding");
    expect(document.body.textContent).toContain("Afficher le gap");
    expect(document.body.textContent).toContain("Afficher le margin");

    act(() => root.unmount());
  });

  it("l'icône ? ouvre le modal des raccourcis, × le ferme", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-help]")?.click());

    expect(document.body.textContent).toContain("Raccourcis");
    expect(document.body.textContent).toContain("Alt + clic");

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label='Fermer']")?.click(),
    );
    expect(document.querySelector("[role='dialog']")).toBeNull();

    act(() => root.unmount());
  });

  it("copie + affiche un toast feedback sur pick (sans onPick custom)", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    const btn = document.querySelector<HTMLButtonElement>(
      "button[aria-label^='renderPicker']",
    );
    act(() => btn?.click());
    act(() => captured?.onPick(result));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]![0]).toContain("[renderPicker]");
    expect(document.body.textContent).toContain("Copié");

    act(() => root.unmount());
  });

  it("copie multi sur onPickMany", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    const btn = document.querySelector<HTMLButtonElement>(
      "button[aria-label^='renderPicker']",
    );
    act(() => btn?.click());
    act(() => captured?.onPickMany?.([result, { ...result, xpath: "/html/body/nav" }]));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]![0]).toContain("[renderPicker] 2 elements");

    act(() => root.unmount());
  });

  it("cocher un paramètre POST les settings vers la route", () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-gear]")?.click());

    const item = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[role='menuitemcheckbox']"),
    ).find((b) => b.textContent?.includes("padding"));
    act(() => item?.click());

    const posted = fetchMock.mock.calls.some(
      (c) => c[0] === "/api/render-picker" && c[1]?.method === "POST",
    );
    expect(posted).toBe(true);

    act(() => root.unmount());
    vi.unstubAllGlobals();
  });
});
