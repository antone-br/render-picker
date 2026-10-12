import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInspector } from "../../src/core/inspector/inspector";
import { CONTEXT_MENU_OPEN } from "../../src/core/inspector/constants/behavior";
import {
  onSelectRequest,
  setTreeSelectMode,
} from "../../src/core/devpanel/inspected";
import { DEFAULT_SETTINGS } from "../../src/core/settings";
import type { PickResult } from "../../src/core/types";

beforeEach(() => {
  // Fake timers : le `swallowTrailingPress` d'un pick (setTimeout 700ms) doit
  // être purgé entre les tests, sinon ses listeners capture avalent les events
  // du test suivant.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  document.body.innerHTML = "";
  document.head.querySelectorAll("style[data-pathpicker-ignore]").forEach((n) =>
    n.remove(),
  );
  document.body.style.cursor = "";
  vi.restoreAllMocks();
});

function stubElementFromPoint(el: Element): void {
  document.elementFromPoint = () => el;
}

/** Dispatch un down sur window quel que soit DOWN_TYPE (pointer ou mouse). */
function pressDown(opts: MouseEventInit): void {
  window.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, ...opts }));
  window.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, ...opts }));
}

describe("createInspector — montage / cleanup", () => {
  it("activate injecte style + container et met le curseur crosshair", () => {
    const insp = createInspector({ onPick: () => {}, onCancel: () => {}, getRoute: () => "/" });
    insp.activate();

    expect(document.head.querySelector("style[data-pathpicker-ignore]")).not.toBeNull();
    expect(document.body.querySelector("[data-pathpicker-ignore]")).not.toBeNull();
    expect(document.body.style.cursor).toBe("crosshair");

    insp.deactivate();
  });

  it("deactivate retire tout et restaure le curseur", () => {
    const insp = createInspector({ onPick: () => {}, onCancel: () => {}, getRoute: () => "/" });
    insp.activate();
    insp.deactivate();

    expect(document.head.querySelector("style[data-pathpicker-ignore]")).toBeNull();
    expect(document.body.querySelector("[data-pathpicker-ignore]")).toBeNull();
    expect(document.body.style.cursor).toBe("");
  });
});

describe("createInspector — interactions", () => {
  it("Échap → onCancel + démontage", () => {
    const onCancel = vi.fn();
    const insp = createInspector({ onPick: () => {}, onCancel, getRoute: () => "/" });
    insp.activate();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector("[data-pathpicker-ignore]")).toBeNull();
  });

  it("clic simple → onPick avec route/xpath/css/tagName", () => {
    document.body.innerHTML = `<main><button id="b">x</button></main>`;
    const btn = document.getElementById("b")!;
    stubElementFromPoint(btn);

    const onPick = vi.fn<(r: PickResult) => void>();
    const insp = createInspector({ onPick, onCancel: () => {}, getRoute: () => "/test" });
    insp.activate();

    pressDown({ clientX: 5, clientY: 5, button: 0 });

    expect(onPick).toHaveBeenCalledTimes(1);
    const result = onPick.mock.calls[0]![0];
    expect(result.route).toBe("/test");
    expect(result.xpath).toBe('//*[@id="b"]');
    expect(result.cssSelector).toBe("#b");
    expect(result.tagName).toBe("button");
    expect(result.id).toBe("b");
  });

  it("mode recherche : clic → pas de pick (exclusif) ; sortie du mode → pick OK", () => {
    document.body.innerHTML = `<main><button id="b">x</button></main>`;
    const btn = document.getElementById("b")!;
    stubElementFromPoint(btn);

    const onPick = vi.fn<(r: PickResult) => void>();
    const insp = createInspector({ onPick, onCancel: () => {}, getRoute: () => "/test" });
    insp.activate();

    insp.setSearchMode(true);
    pressDown({ clientX: 5, clientY: 5, button: 0 });
    expect(onPick).toHaveBeenCalledTimes(0);

    insp.setSearchMode(false);
    pressDown({ clientX: 5, clientY: 5, button: 0 });
    expect(onPick).toHaveBeenCalledTimes(1);
    insp.deactivate();
  });

  it("Maj+clic accumule, Entrée → onPickMany", () => {
    document.body.innerHTML = `<ul><li id="a">a</li></ul>`;
    const li = document.getElementById("a")!;
    stubElementFromPoint(li);

    const onPickMany = vi.fn<(r: PickResult[]) => void>();
    const insp = createInspector({
      onPick: () => {},
      onPickMany,
      onCancel: () => {},
      getRoute: () => "/",
      multi: true,
    });
    insp.activate();

    pressDown({ clientX: 1, clientY: 1, button: 0, shiftKey: true });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onPickMany).toHaveBeenCalledTimes(1);
    expect(onPickMany.mock.calls[0]![0]).toHaveLength(1);
    expect(onPickMany.mock.calls[0]![0][0]!.xpath).toBe('//*[@id="a"]');
  });

  it("Maj+clic puis clic simple accumulent (sans re-Maj) → onPickMany 2 + onSelectionChange", () => {
    document.body.innerHTML = `<ul><li id="a">a</li><li id="b">b</li></ul>`;
    const a = document.getElementById("a")!;
    const b = document.getElementById("b")!;

    const onPickMany = vi.fn<(r: PickResult[]) => void>();
    const onSelectionChange = vi.fn<(n: number) => void>();
    const insp = createInspector({
      onPick: () => {},
      onPickMany,
      onCancel: () => {},
      getRoute: () => "/",
      multi: true,
      onSelectionChange,
    });
    insp.activate();

    stubElementFromPoint(a);
    pressDown({ clientX: 1, clientY: 1, button: 0, shiftKey: true }); // démarre
    stubElementFromPoint(b);
    pressDown({ clientX: 2, clientY: 2, button: 0 }); // clic simple → accumule
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onSelectionChange).toHaveBeenCalledWith(2);
    expect(onPickMany).toHaveBeenCalledTimes(1);
    expect(onPickMany.mock.calls[0]![0]).toHaveLength(2);
  });

  it("commandes remappées : copier = clic droit → clic gauche n'ouvre rien, contextmenu pick", () => {
    document.body.innerHTML = `<main><button id="b">x</button></main>`;
    const btn = document.getElementById("b")!;
    stubElementFromPoint(btn);

    const onPick = vi.fn<(r: PickResult) => void>();
    const insp = createInspector({
      onPick,
      onCancel: () => {},
      getRoute: () => "/",
      getCommands: () => ({
        ...DEFAULT_SETTINGS.commands,
        copy: { modifier: "none", trigger: "rightclick" },
      }),
    });
    insp.activate();

    // Clic gauche ne matche plus « copier » (rightclick).
    pressDown({ clientX: 5, clientY: 5, button: 0 });
    expect(onPick).not.toHaveBeenCalled();

    // Clic droit (contextmenu) matche.
    window.dispatchEvent(
      new MouseEvent("contextmenu", { clientX: 5, clientY: 5, button: 2, bubbles: true }),
    );
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("clic droit (défaut) → menu contextuel (el + position curseur)", () => {
    document.body.innerHTML = `<main><button id="b">x</button></main>`;
    const btn = document.getElementById("b")!;
    stubElementFromPoint(btn);

    const onContextMenu = vi.fn<(el: Element, pos: { x: number; y: number }) => void>();
    const insp = createInspector({
      onPick: () => {},
      onContextMenu,
      onCancel: () => {},
      getRoute: () => "/",
    });
    insp.activate();

    window.dispatchEvent(
      new MouseEvent("contextmenu", { clientX: 5, clientY: 5, button: 2, bubbles: true }),
    );

    expect(onContextMenu).toHaveBeenCalledTimes(1);
    expect(onContextMenu.mock.calls[0]![0]).toBe(btn);
    expect(onContextMenu.mock.calls[0]![1]).toEqual({ x: 5, y: 5 });
    insp.deactivate();
  });

  it("clic gauche → onPick, jamais de menu contextuel", () => {
    document.body.innerHTML = `<main><button id="b">x</button></main>`;
    const btn = document.getElementById("b")!;
    stubElementFromPoint(btn);

    const onPick = vi.fn();
    const onContextMenu = vi.fn();
    const insp = createInspector({
      onPick,
      onContextMenu,
      onCancel: () => {},
      getRoute: () => "/",
    });
    insp.activate();

    pressDown({ clientX: 5, clientY: 5, button: 0 });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onContextMenu).not.toHaveBeenCalled();
  });

  it("menu contextuel ouvert : le clic de fermeture ne pick pas ; le suivant oui", () => {
    document.body.innerHTML = `<main><button id="b">x</button></main>`;
    const btn = document.getElementById("b")!;
    stubElementFromPoint(btn);

    const onPick = vi.fn<(r: PickResult) => void>();
    const insp = createInspector({ onPick, onCancel: () => {}, getRoute: () => "/test" });
    insp.activate();

    CONTEXT_MENU_OPEN.value = true;
    pressDown({ clientX: 5, clientY: 5, button: 0 });
    expect(onPick).toHaveBeenCalledTimes(0);

    // Menu fermé (comme la sortie du handler du composant) :
    CONTEXT_MENU_OPEN.value = false;
    pressDown({ clientX: 5, clientY: 5, button: 0 });
    expect(onPick).toHaveBeenCalledTimes(1);
    insp.deactivate();
    CONTEXT_MENU_OPEN.value = false;
  });

  it("refreshDecorations met à jour les décorations sans mousemove", () => {
    document.body.innerHTML = `<main><section id="s">x</section></main>`;
    const el = document.getElementById("s")!;
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
    stubElementFromPoint(el);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      display: "block",
      borderTopWidth: "0px",
      borderRightWidth: "0px",
      borderBottomWidth: "0px",
      borderLeftWidth: "0px",
      paddingTop: "10px",
      paddingRight: "10px",
      paddingBottom: "10px",
      paddingLeft: "10px",
    } as CSSStyleDeclaration);

    const overlays = { padding: true, gap: false, margin: false };
    const insp = createInspector({
      onPick: () => {},
      onCancel: () => {},
      getRoute: () => "/",
      getOverlays: () => overlays,
    });
    insp.activate();

    // Survol → décorations padding dessinées.
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 5, clientY: 5 }));
    const decor = document.body.querySelector("[data-pathpicker-ignore]")!
      .firstElementChild!; // decorLayer (1er enfant du container)
    expect(decor.children.length).toBe(1); // 1 div padding (bordure = padding)

    // Décocher sans bouger la souris → refreshDecorations vide le layer.
    overlays.padding = false;
    insp.refreshDecorations();
    expect(decor.children.length).toBe(0);

    insp.deactivate();
  });

  it("Échap pendant une sélection multiple → onCancel + démontage", () => {
    document.body.innerHTML = `<ul><li id="a">a</li></ul>`;
    const li = document.getElementById("a")!;
    stubElementFromPoint(li);

    const onCancel = vi.fn();
    const onPickMany = vi.fn();
    const insp = createInspector({
      onPick: () => {},
      onPickMany,
      onCancel,
      getRoute: () => "/",
      multi: true,
    });
    insp.activate();

    pressDown({ clientX: 1, clientY: 1, button: 0, shiftKey: true });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPickMany).not.toHaveBeenCalled();
    expect(document.body.querySelector("[data-pathpicker-ignore]")).toBeNull();
  });
});

/** Dispatch un keydown avec un `timeStamp` imposé (jsdom ignore l'init timeStamp). */
function dispatchKey(opts: KeyboardEventInit, timeStamp: number): void {
  const e = new KeyboardEvent("keydown", { bubbles: true, ...opts });
  Object.defineProperty(e, "timeStamp", { value: timeStamp, configurable: true });
  window.dispatchEvent(e);
}

describe("createInspector — commande clavier inspect", () => {
  it("inspect défaut (Ctrl + I, simple) : un appui → onInspect(el), reste armé (drill au survol)", () => {
    document.body.innerHTML = `<main><button id="b">x</button></main>`;
    const btn = document.getElementById("b")!;
    stubElementFromPoint(btn);

    const onInspect = vi.fn<(el: Element) => void>();
    const insp = createInspector({
      onPick: () => {},
      onCancel: () => {},
      getRoute: () => "/",
      onInspect,
    });
    insp.activate();

    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 5, clientY: 5, bubbles: true }));
    dispatchKey({ key: "i", ctrlKey: true }, 0);

    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onInspect.mock.calls[0]![0]).toBe(btn);
    // Reste armé : l'overlay/UI de l'inspecteur est toujours monté (le survol continue de piloter l'arbre).
    expect(document.body.querySelector("[data-pathpicker-ignore]")).not.toBeNull();

    insp.deactivate();
  });

  it("mode select-in-tree : clic page → pas de pick/copie, demande de sélection", () => {
    document.body.innerHTML = `<main><button id="b">x</button></main>`;
    const btn = document.getElementById("b")!;
    stubElementFromPoint(btn);

    const onPick = vi.fn<(r: PickResult) => void>();
    const selected = vi.fn<(el: Element) => void>();
    const insp = createInspector({ onPick, onCancel: () => {}, getRoute: () => "/" });
    insp.activate();
    setTreeSelectMode(true);
    const unsub = onSelectRequest(selected);

    pressDown({ clientX: 5, clientY: 5, button: 0 });

    expect(onPick).not.toHaveBeenCalled(); // pas de copie
    expect(selected).toHaveBeenCalledWith(btn); // sélection dans l'arbre
    expect(document.body.querySelector("[data-pathpicker-ignore]")).not.toBeNull(); // reste armé

    unsub();
    setTreeSelectMode(false);
    insp.deactivate();
  });
});

describe("createInspector — suivi scroll", () => {
  const rectAt = (top: number): DOMRect =>
    ({ top, left: 10, width: 100, height: 40, right: 110, bottom: top + 40, x: 10, y: top, toJSON: () => ({}) }) as DOMRect;

  /** Overlay de survol : 3ᵉ enfant du conteneur (decorLayer, markerLayer, overlay). */
  const overlay = (): HTMLElement =>
    document.body.querySelector("div[data-pathpicker-ignore]")!.children[2] as HTMLElement;

  /** Arme l'inspecteur et survole un bouton dont le rect est piloté par `setTop`. */
  function hoverButton() {
    document.body.innerHTML = `<main><button id="b">x</button></main>`;
    const btn = document.getElementById("b")!;
    let top = 50;
    vi.spyOn(btn, "getBoundingClientRect").mockImplementation(() => rectAt(top));
    stubElementFromPoint(btn);
    const insp = createInspector({ onPick: () => {}, onCancel: () => {}, getRoute: () => "/" });
    insp.activate();
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 60 }));
    return { btn, insp, setTop: (v: number) => (top = v) };
  }

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0; // synchrone : aucune frame en attente
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Espionne la lecture `offsetWidth` (reflow forcé ⇔ repositionnement sans glisse). */
  function spyReflow(el: HTMLElement) {
    const reflow = vi.fn(() => 0);
    Object.defineProperty(el, "offsetWidth", { get: reflow, configurable: true });
    return reflow;
  }

  it("survol A → B : la notification initiale du ResizeObserver ne coupe pas la glisse", () => {
    // Faux RO : comme un vrai, il notifie dès `observe()`.
    class FakeResizeObserver {
      private readonly cb: () => void;
      constructor(cb: () => void) {
        this.cb = cb;
      }
      observe(): void {
        this.cb();
      }
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);

    document.body.innerHTML = `<main><button id="a">a</button><button id="b">b</button></main>`;
    const a = document.getElementById("a")!;
    const b = document.getElementById("b")!;
    vi.spyOn(a, "getBoundingClientRect").mockImplementation(() => rectAt(50));
    vi.spyOn(b, "getBoundingClientRect").mockImplementation(() => rectAt(200));
    const insp = createInspector({ onPick: () => {}, onCancel: () => {}, getRoute: () => "/" });
    insp.activate();

    stubElementFromPoint(a);
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 60 }));
    const reflow = spyReflow(overlay());

    stubElementFromPoint(b);
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 210 }));

    expect(overlay().style.top).toBe("200px");
    expect(reflow).not.toHaveBeenCalled(); // pas de repositionnement instantané
    expect(overlay().style.transition).not.toBe("none");
    insp.deactivate();
  });

  it("scroll sans déplacement → no-op ; avec déplacement → recollé sans glisse", () => {
    const { insp, setTop } = hoverButton();
    const reflow = spyReflow(overlay());

    window.dispatchEvent(new Event("scroll"));
    expect(reflow).not.toHaveBeenCalled();

    setTop(10);
    window.dispatchEvent(new Event("scroll"));
    expect(reflow).toHaveBeenCalled();
    expect(overlay().style.top).toBe("10px");
    insp.deactivate();
  });

  it("scroll → l'overlay suit l'élément survolé", () => {
    const { insp, setTop } = hoverButton();
    expect(overlay().style.top).toBe("50px");

    setTop(-120);
    window.dispatchEvent(new Event("scroll"));

    expect(overlay().style.top).toBe("-120px");
    expect(overlay().style.opacity).toBe("1");
    insp.deactivate();
  });

  it("resize → l'overlay suit l'élément survolé", () => {
    const { insp, setTop } = hoverButton();

    setTop(200);
    window.dispatchEvent(new Event("resize"));

    expect(overlay().style.top).toBe("200px");
    insp.deactivate();
  });

  it("transitionend ne repositionne pas l'overlay (glisse préservée)", () => {
    const { insp, setTop } = hoverButton();

    setTop(300);
    window.dispatchEvent(new Event("transitionend"));

    expect(overlay().style.top).toBe("50px");
    insp.deactivate();
  });

  it("scroll sans survol ou en mode recherche → overlay reste masqué", () => {
    const insp = createInspector({ onPick: () => {}, onCancel: () => {}, getRoute: () => "/" });
    insp.activate();
    window.dispatchEvent(new Event("scroll"));
    expect(overlay().style.opacity).toBe("0");
    insp.deactivate();

    const hovered = hoverButton();
    hovered.insp.setSearchMode(true);
    window.dispatchEvent(new Event("scroll"));
    expect(overlay().style.opacity).toBe("0");
    hovered.insp.deactivate();
  });

  describe("menu contextuel ouvert", () => {
    /** Simule le curseur sur le menu (élément ignoré par l'inspecteur). */
    function pointOnMenu(): void {
      const menu = document.createElement("div");
      menu.setAttribute("data-pathpicker-ignore", "");
      document.body.appendChild(menu);
      stubElementFromPoint(menu);
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 400, clientY: 400 }));
    }

    afterEach(() => {
      CONTEXT_MENU_OPEN.value = false;
    });

    it("curseur hors de l'élément → le rect reste visible sur l'élément", () => {
      const { insp } = hoverButton();
      CONTEXT_MENU_OPEN.value = true;

      pointOnMenu();

      expect(overlay().style.opacity).toBe("1");
      expect(overlay().style.top).toBe("50px");
      insp.deactivate();
    });

    it("scroll pendant que le menu est ouvert → le rect suit l'élément", () => {
      const { insp, setTop } = hoverButton();
      CONTEXT_MENU_OPEN.value = true;
      pointOnMenu();

      setTop(-80);
      window.dispatchEvent(new Event("scroll"));

      expect(overlay().style.opacity).toBe("1");
      expect(overlay().style.top).toBe("-80px");
      insp.deactivate();
    });

    it("menu fermé → le survol reprend normalement", () => {
      const { insp } = hoverButton();
      CONTEXT_MENU_OPEN.value = true;
      pointOnMenu();
      CONTEXT_MENU_OPEN.value = false;

      pointOnMenu();

      expect(overlay().style.opacity).toBe("0");
      insp.deactivate();
    });
  });

  it("élément retiré du DOM puis scroll → survol masqué", () => {
    const { btn, insp } = hoverButton();
    expect(overlay().style.opacity).toBe("1");

    btn.remove();
    window.dispatchEvent(new Event("scroll"));

    expect(overlay().style.opacity).toBe("0");
    insp.deactivate();
  });
});
