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
import { resetSettingsRouteCache } from "../src/core/settings";

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
  resetSettingsRouteCache();
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

  it("préserve la casse des éléments SVG (camelCase)", () => {
    const out = formatHtml(
      '<svg><defs><linearGradient id="g"></linearGradient></defs><clipPath id="c"></clipPath></svg>',
    );
    expect(out).toContain("<linearGradient");
    expect(out).toContain("<clipPath");
    expect(out).not.toContain("<lineargradient");
    expect(out).not.toContain("<clippath");
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

  it("prompt REPL de la console évalue l'expression (écho + résultat)", () => {
    window.localStorage.clear();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-panel]")?.click());
    // Onglet Console actif (bouton dont le texte commence par « Console »).
    const consoleTab = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent?.startsWith("Console"));
    act(() => consoleTab?.click());

    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Console REPL"]',
    )!;
    expect(input).not.toBeNull();

    // Saisie contrôlée : setter natif + event input, puis Entrée.
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setValue.call(input, "2 + 3");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(logSpy).toHaveBeenCalledWith("› 2 + 3");
    expect(logSpy).toHaveBeenCalledWith(5);
    expect(input.value).toBe(""); // vidé après exécution

    logSpy.mockRestore();
    act(() => root.unmount());
  });

  it("onglet HTML affiche l'arbre DOM depuis <body>", () => {
    window.localStorage.clear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-panel]")?.click());
    const htmlTab = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent === "HTML");
    act(() => htmlTab?.click());

    // La racine <body> apparaît dans l'arbre (span tag « body »).
    const bodyTag = Array.from(document.querySelectorAll("span")).some(
      (s) => s.textContent === "body",
    );
    expect(bodyTag).toBe(true);

    act(() => root.unmount());
  });

  it("onglet HTML : survol inspecteur révèle le nœud (déplie ancêtres + la div visée)", () => {
    window.localStorage.clear();
    const nested = document.createElement("section");
    nested.innerHTML = '<article><b>x</b></article>';
    document.body.appendChild(nested);
    const deep = nested.querySelector("article")!;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-panel]")?.click());
    act(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .find((b) => b.textContent === "HTML")
        ?.click(),
    );

    const tagShown = (t: string) =>
      Array.from(document.querySelectorAll("span")).some((s) => s.textContent === t);

    // Replié par défaut (section non dépliée) → article invisible.
    expect(tagShown("article")).toBe(false);

    // L'inspecteur survole `article` → reveal : ancêtres + la div visée dépliés
    // → `article` ET son enfant `b` sont visibles.
    act(() => captured?.onHover?.(deep));
    expect(tagShown("article")).toBe(true);
    expect(tagShown("b")).toBe(true);

    act(() => root.unmount());
    nested.remove();
  });

  it("quitter l'onglet HTML efface la sélection (pas de re-sélection au retour)", () => {
    window.localStorage.clear();
    const nested = document.createElement("section");
    nested.innerHTML = "<article><b>x</b></article>";
    document.body.appendChild(nested);
    const deep = nested.querySelector("article")!;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-panel]")?.click());
    const tab = (label: string) =>
      Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === label || b.textContent?.startsWith(`${label} (`),
      );
    act(() => tab("HTML")?.click());

    const articleShown = () =>
      Array.from(document.querySelectorAll("span")).some((s) => s.textContent === "article");

    act(() => captured?.onHover?.(deep));
    expect(articleShown()).toBe(true); // révélé

    // Quitter HTML → revenir : la div n'est plus auto-sélectionnée/révélée.
    act(() => tab("Console")?.click());
    act(() => tab("HTML")?.click());
    expect(articleShown()).toBe(false);

    act(() => root.unmount());
    nested.remove();
  });

  it("arbre HTML : clic sélectionne une ligne, clic ailleurs désélectionne", () => {
    window.localStorage.clear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-panel]")?.click());
    act(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .find((b) => b.textContent === "HTML")
        ?.click(),
    );

    const row = document.querySelector<HTMLElement>("[data-rp-tree-row]")!;
    expect(row).not.toBeNull();

    // Clic sur la ligne → sélection (fond bleu, non transparent). Le mode inspect reste actif.
    act(() => row.click());
    expect(row.style.background).not.toBe("transparent");
    expect(row.style.background).not.toBe("");
    expect(document.querySelector("button[data-rp-gear]")).not.toBeNull(); // reste armé

    // Clic ailleurs (hors ligne) → désélection.
    act(() => document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
    expect(row.style.background).toBe("transparent");

    act(() => root.unmount());
  });

  it("arbre HTML : clic droit sur une ligne → menu copier HTML/classes/XPath", () => {
    window.localStorage.clear();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    document.body.innerHTML = `<main id="app"><button class="b c">x</button></main>`;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-panel]")?.click());
    act(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .find((b) => b.textContent === "HTML")
        ?.click(),
    );

    const row = document.querySelector<HTMLElement>("[data-rp-tree-row]")!;
    act(() => row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true })));

    const cm = document.querySelector("[data-rp-contextmenu]");
    expect(cm).not.toBeNull();
    const labels = Array.from(cm!.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toEqual([
      "Copier le HTML",
      "Copier le rendu",
      "Copier les classes",
      "Copier le XPath",
    ]);

    const xpathBtn = Array.from(cm!.querySelectorAll("button")).find(
      (b) => b.textContent === "Copier le XPath",
    )!;
    act(() => xpathBtn.click());
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(typeof writeText.mock.calls[0]![0]).toBe("string");
    expect(document.querySelector("[data-rp-contextmenu]")).toBeNull(); // menu fermé

    act(() => root.unmount());
  });

  it("Ctrl+I (inspect) panneau fermé → ouvre l'onglet HTML et révèle la div", () => {
    window.localStorage.clear();
    const nested = document.createElement("section");
    nested.innerHTML = '<article>art</article>';
    document.body.appendChild(nested);
    const deep = nested.querySelector("article")!;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    const articleShown = () =>
      Array.from(document.querySelectorAll("span")).some((s) => s.textContent === "article");

    // Panneau HTML fermé → l'arbre n'est pas monté, `article` invisible.
    expect(articleShown()).toBe(false);

    // Inspecter `article` (Ctrl+I) → ouvre le panneau sur HTML + révèle la div.
    act(() => captured?.onInspect?.(deep));
    expect(articleShown()).toBe(true); // ancêtres dépliés → div révélée

    act(() => root.unmount());
    nested.remove();
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

  it("« Rechercher » et « Ouvrir l'inspecteur » : deux dropdowns (modificateur + touche)", () => {
    window.localStorage.clear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    act(() =>
      document.querySelector<HTMLButtonElement>("button[aria-label^='renderPicker']")?.click(),
    );
    act(() => document.querySelector<HTMLButtonElement>("button[data-rp-gear]")?.click());

    const byLabel = (l: string) =>
      document.querySelector<HTMLButtonElement>(`button[aria-label="${l}"]`);

    // search : défaut Ctrl + double-tap F → modificateur « Ctrl », touche « F F ».
    expect(byLabel("Rechercher — modificateur")?.textContent).toContain("Ctrl");
    expect(byLabel("Rechercher — touche")?.textContent).toContain("F F");

    // inspect : défaut Ctrl + I (simple) → modificateur « Ctrl », touche « I ».
    expect(byLabel("Ouvrir l'inspecteur — modificateur")?.textContent).toContain("Ctrl");
    const inspectKey = byLabel("Ouvrir l'inspecteur — touche");
    expect(inspectKey).not.toBeNull();
    expect(inspectKey?.textContent).toContain("I");
    expect(inspectKey?.textContent).not.toContain("I I");

    act(() => root.unmount());
  });

  it("Ctrl + F F (double-tap) ouvre la recherche MÊME picker non armé (+ arme)", () => {
    window.localStorage.clear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    const ctrlF = (timeStamp: number) => {
      const e = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true });
      Object.defineProperty(e, "timeStamp", { value: timeStamp, configurable: true });
      window.dispatchEvent(e);
    };

    // Non armé au départ : pas de popover de recherche.
    expect(document.querySelector("[data-rp-search-popover]")).toBeNull();

    // 1er tap avalé (pas d'ouverture), 2e tap dans la fenêtre → arme + ouvre.
    act(() => ctrlF(0));
    expect(document.querySelector("[data-rp-search-popover]")).toBeNull();
    act(() => ctrlF(100));

    expect(document.querySelector("[data-rp-search-popover]")).not.toBeNull();
    // Armé : la barre du bas (engrenage) est montée.
    expect(document.querySelector("button[data-rp-gear]")).not.toBeNull();

    act(() => root.unmount());
  });

  it("la nav (1/1 + flèches) est une boîte séparée ; cliquer dedans ne ferme pas", () => {
    window.localStorage.clear();
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    const ctrlF = (timeStamp: number) => {
      const e = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true });
      Object.defineProperty(e, "timeStamp", { value: timeStamp, configurable: true });
      window.dispatchEvent(e);
    };
    act(() => ctrlF(0));
    act(() => ctrlF(100));

    // Boîte nav distincte de la carte popover, avec les deux flèches.
    const prev = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Occurrence précédente"]',
    );
    const next = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Occurrence suivante"]',
    );
    expect(prev).not.toBeNull();
    expect(next).not.toBeNull();
    // La nav est une boîte distincte (hors de la ligne input et de la liste de résultats).
    expect(prev!.closest("[role='searchbox']")).toBeNull();

    // Cliquer dans la nav ne ferme pas le popover (porte data-rp-search-ui).
    act(() => {
      prev!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      prev!.click();
    });
    expect(document.querySelector("[data-rp-search-popover]")).not.toBeNull();

    act(() => root.unmount());
  });
});

describe("Tooltip", () => {
  it("affiche le contenu au survol (portal), le masque à la sortie", async () => {
    const { Tooltip } = await import("../src/ui/tooltip");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <Tooltip content="Aide reproductible">
          <button type="button">i</button>
        </Tooltip>,
      );
    });

    // Monté : le contenu est dans le portal (document.body), opacité 0 au repos.
    const portal = document.querySelector<HTMLElement>("[data-pathpicker-ignore]");
    expect(portal).not.toBeNull();
    expect(portal!.textContent).toContain("Aide reproductible");
    expect(portal!.style.opacity).toBe("0");

    // Survol du trigger → visible (React dérive onMouseEnter de mouseover).
    const trigger = host.querySelector("span")!;
    act(() => {
      trigger.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(portal!.style.opacity).toBe("1");

    // Sortie → masqué (onMouseLeave dérivé de mouseout).
    act(() => {
      trigger.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    expect(portal!.style.opacity).toBe("0");

    act(() => root.unmount());
  });
});

describe("ContextMenu", () => {
  it("rend les items (label + icône), déclenche onClick de la ligne", async () => {
    const { ContextMenu } = await import("../src/ui/context-menu");
    const { CopyIcon } = await import("../src/ui/icons");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    const onA = vi.fn();
    const onB = vi.fn();
    const el = document.createElement("div");

    act(() => {
      root.render(
        <ContextMenu
          at={{ el, x: 10, y: 10 }}
          onClose={() => {}}
          items={[
            { label: "Copier le rendu", icon: <CopyIcon />, info: "Aide rendu", onClick: onA },
            { label: "Copier le XPath", onClick: onB },
          ]}
        />,
      );
    });

    const panel = document.querySelector("[data-rp-contextmenu]")!;
    const buttons = Array.from(panel.querySelectorAll("button"));
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Copier le rendu",
      "Copier le XPath",
    ]);
    // L'item « rendu » porte une icône (svg) ; l'ⓘ ajoute une 2e svg (info).
    expect(buttons[0]!.querySelectorAll("svg").length).toBe(2);
    expect(buttons[1]!.querySelectorAll("svg").length).toBe(0);

    // Clic sur la ligne → onClick de l'item.
    act(() => buttons[1]!.click());
    expect(onB).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });

  it("le tooltip ⓘ s'affiche au survol et son clic ne déclenche pas la copie", async () => {
    const { ContextMenu } = await import("../src/ui/context-menu");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    const onA = vi.fn();
    const el = document.createElement("div");

    act(() => {
      root.render(
        <ContextMenu
          at={{ el, x: 0, y: 0 }}
          onClose={() => {}}
          items={[{ label: "Copier le rendu", info: "Aide rendu autoportant", onClick: onA }]}
        />,
      );
    });

    // Contenu du tooltip présent dans un portal, masqué au repos.
    const tip = Array.from(
      document.querySelectorAll<HTMLElement>("[data-pathpicker-ignore]"),
    ).find((n) => n.textContent?.includes("Aide rendu autoportant"))!;
    expect(tip).toBeTruthy();
    expect(tip.style.opacity).toBe("0");

    // L'ⓘ (svg du bouton) : survol → tooltip visible.
    const infoSvg = document.querySelector("[data-rp-contextmenu] button svg")!;
    act(() => infoSvg.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(tip.style.opacity).toBe("1");

    // Clic sur l'ⓘ : stopPropagation → la copie (onClick ligne) ne part pas.
    act(() => infoSvg.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onA).not.toHaveBeenCalled();

    act(() => root.unmount());
  });
});
