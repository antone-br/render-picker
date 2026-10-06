import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPanelState } from "../src/core/devpanel/panel-state";

import type { InspectorCallbacks } from "../src/core/types";

// Capture les callbacks passés à l'inspecteur pour les déclencher à la main.
let captured: InspectorCallbacks | null = null;
vi.mock("../src/core/inspector/inspector", () => ({
  createInspector: (cb: InspectorCallbacks) => {
    captured = cb;
    return {
      activate: () => {},
      deactivate: () => {},
      refreshDecorations: () => {},
      setSearchMode: () => {},
    };
  },
}));

import {
  RenderPickerButton,
  formatHtml,
  formatResult,
  formatResults,
} from "../src/react";
import type { PickResult } from "../src/core/types";
import { addRequest, clearLogs, clearRequests } from "../src/core/devpanel/store";

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
  window.localStorage.clear();
  clearLogs();
  clearRequests();
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

describe("formatHtml", () => {
  it("indente, inline le texte simple, void sans fermeture", () => {
    const out = formatHtml(`<div class="a"><span>x</span><img src="y"></div>`);
    expect(out).toBe(
      ['<div class="a">', '  <span>x</span>', '  <img src="y">', "</div>"].join("\n"),
    );
  });

  it("ignore le texte whitespace-only entre balises", () => {
    const out = formatHtml(`<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>`);
    expect(out).toBe(
      ["<ul>", "  <li>a</li>", "  <li>b</li>", "</ul>"].join("\n"),
    );
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

  it("onInspect ouvre le panneau (Console/Network)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));
    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );

    act(() => captured?.onInspect?.(el));

    expect(document.body.textContent).toContain("Console");
    expect(document.body.textContent).toContain("Network");

    act(() => root.unmount());
  });

  it("déplier une requête Network montre les détails (headers)", () => {
    window.localStorage.clear();
    clearRequests();
    addRequest({
      method: "GET",
      url: "/seed",
      status: 200,
      ok: true,
      durationMs: 5,
      ts: 0,
      reqHeaders: { authorization: "tok" },
      resBody: "hello",
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));
    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-panel]")?.click());

    // Onglet Network
    const netTab = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.startsWith("Network"),
    );
    act(() => netTab?.click());

    // Ligne de la requête → clic sur le parent du span url
    const urlSpan = Array.from(document.querySelectorAll("span")).find(
      (s) => s.textContent === "/seed",
    );
    act(() => (urlSpan?.parentElement as HTMLElement | undefined)?.click());

    expect(document.body.textContent).toContain("Request headers");
    expect(document.body.textContent).toContain("Response");

    act(() => root.unmount());
  });

  it("le bouton de la barre ouvre le panneau", () => {
    window.localStorage.clear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));
    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-panel]")?.click());

    expect(document.body.textContent).toContain("Console");
    expect(document.body.textContent).toContain("Network");

    act(() => root.unmount());
  });

  it("pose le marqueur data-render-picker (retiré au démontage)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));
    expect(document.documentElement.getAttribute("data-render-picker")).toBe("npm");
    act(() => root.unmount());
    expect(document.documentElement.hasAttribute("data-render-picker")).toBe(false);
  });

  it("l'icône paramètre ouvre le dropdown des commandes (plus de toggles overlay)", () => {
    window.localStorage.clear();
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

    expect(document.body.textContent).toContain("Commandes");
    expect(document.body.textContent).toContain("Armer le picker");
    expect(document.body.textContent).toContain("Copier le HTML");
    expect(document.body.textContent).toContain("Ouvrir le composant");
    // Les anciens toggles overlay ont disparu.
    expect(document.body.textContent).not.toContain("Afficher le padding");

    // Re-lock du gear : le menu se ferme (toggle).
    act(() => gear?.click());
    expect(document.body.textContent).not.toContain("Armer le picker");

    act(() => root.unmount());
  });

  it("la loupe s'ouvre puis se referme au re-clic (toggle, pas de race pointerdown)", () => {
    window.localStorage.clear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    const btn = document.querySelector<HTMLButtonElement>(
      "button[aria-label^='renderPicker']",
    );
    act(() => btn?.click());

    const loupe = document.querySelector<HTMLButtonElement>("button[data-rp-search]");
    expect(loupe?.getAttribute("aria-expanded")).toBe("false");
    act(() => loupe?.click());
    expect(loupe?.getAttribute("aria-expanded")).toBe("true");
    act(() => loupe?.click());
    expect(loupe?.getAttribute("aria-expanded")).toBe("false");

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

  it("le bouton inspecteur bascule le panneau (ouvre puis ferme)", () => {
    window.localStorage.clear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    const btn = document.querySelector<HTMLButtonElement>(
      "button[aria-label^='renderPicker']",
    );
    act(() => btn?.click());

    const panelBtn = document.querySelector<HTMLButtonElement>("button[data-rp-panel]");

    act(() => panelBtn?.click());
    expect(loadPanelState().open).toBe(true);

    act(() => panelBtn?.click());
    expect(loadPanelState().open).toBe(false);

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

  it("changer une commande POST les settings vers la route", () => {
    window.localStorage.clear();
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

    // Ouvre le Select « modificateur » de la commande « Ouvrir la source ».
    const sel = document.querySelector<HTMLButtonElement>(
      "button[aria-label='Ouvrir le composant (global) — modificateur']",
    );
    expect(sel).not.toBeNull();
    act(() => sel?.click());

    // Choisit « Ctrl » (≠ défaut Alt) → change les commandes → POST.
    const opt = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[role='option']"),
    ).find((b) => b.textContent === "Ctrl");
    act(() => opt?.click());

    const posted = fetchMock.mock.calls.some(
      (c) => c[0] === "/api/render-picker" && c[1]?.method === "POST",
    );
    expect(posted).toBe(true);

    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it("« Réinitialiser » remet les commandes aux défauts", () => {
    window.localStorage.clear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-gear]")?.click());

    const sel = () =>
      document.querySelector<HTMLButtonElement>(
        "button[aria-label='Ouvrir le composant (global) — modificateur']",
      );
    expect(sel()?.textContent).toContain("Alt");

    // Change source → Ctrl.
    act(() => sel()?.click());
    const alt = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[role='option']"),
    ).find((b) => b.textContent === "Ctrl");
    act(() => alt?.click());
    expect(sel()?.textContent).toContain("Ctrl");

    // Réinitialiser → retour au défaut Alt.
    const reset = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent === "Réinitialiser");
    act(() => reset?.click());
    expect(sel()?.textContent).toContain("Alt");

    act(() => root.unmount());
  });
});
