import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInspector } from "../src/core/inspector/inspector";
import type { PickResult } from "../src/core/types";

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
});
