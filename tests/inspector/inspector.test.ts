import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInspector } from "../../src/core/inspector/inspector";
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
