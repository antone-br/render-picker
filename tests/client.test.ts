import { afterEach, describe, expect, it, vi } from "vitest";

import { initRenderPicker } from "../src/client";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("initRenderPicker", () => {
  it("no-op si désactivé", () => {
    const log = console.log;
    const dispose = initRenderPicker({ enabled: false });
    expect(console.log).toBe(log);
    dispose();
  });

  it("filtre le bruit console puis restaure au dispose", () => {
    const spy = vi.fn();
    console.log = spy;
    const dispose = initRenderPicker({
      enabled: true,
      clickToSource: false,
      annotate: false,
    });
    console.log("[HMR] connected");
    console.log("garde");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("garde");
    dispose();
    expect(console.log).toBe(spy);
  });

  it("Ctrl+clic sur [data-source] ouvre l'URI VS Code", () => {
    document.body.innerHTML = `<div data-source="src/a.tsx:3"><span>x</span></div>`;
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        clicks.push(this.href);
      },
    );
    const dispose = initRenderPicker({
      enabled: true,
      projectRoot: "C:\\proj",
      annotate: false,
      hushConsole: false,
    });
    const span = document.querySelector("span")!;
    span.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, ctrlKey: true, button: 0 }),
    );
    expect(clicks).toEqual(["vscode://file/C:/proj/src/a.tsx:3"]);

    dispose();
    span.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, ctrlKey: true, button: 0 }),
    );
    expect(clicks).toHaveLength(1);
  });

  it("pose le marqueur data-render-picker, retiré au dispose", () => {
    const dispose = initRenderPicker({
      enabled: true,
      clickToSource: false,
      annotate: false,
      hushConsole: false,
    });
    expect(document.documentElement.getAttribute("data-render-picker")).toBe("npm");
    dispose();
    expect(document.documentElement.hasAttribute("data-render-picker")).toBe(false);
  });

  it("pas de marqueur si désactivé", () => {
    const dispose = initRenderPicker({ enabled: false });
    expect(document.documentElement.hasAttribute("data-render-picker")).toBe(false);
    dispose();
  });

  it("annote après le délai configuré", () => {
    vi.useFakeTimers();
    const dispose = initRenderPicker({
      enabled: true,
      annotate: { delayMs: 50 },
      clickToSource: false,
      hushConsole: false,
    });
    const observe = vi.spyOn(MutationObserver.prototype, "observe");
    vi.advanceTimersByTime(49);
    expect(observe).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(observe).toHaveBeenCalledTimes(1);
    dispose();
  });
});
