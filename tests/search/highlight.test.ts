import { afterEach, describe, expect, it, vi } from "vitest";

import { createSearchHighlight } from "../../src/core/search/highlight";

afterEach(() => {
  document.documentElement.innerHTML = "";
});

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("createSearchHighlight", () => {
  it("attache une couche fixe ignorée par le picker (z OVERLAY_Z)", () => {
    const hl = createSearchHighlight();
    const layer = document.querySelector<HTMLElement>("[data-pathpicker-ignore]");
    expect(layer).not.toBeNull();
    expect(layer!.style.position).toBe("fixed");
    expect(layer!.style.zIndex).toBeTruthy();
    hl.destroy();
    expect(document.querySelector("[data-pathpicker-ignore]")).toBeNull();
  });

  it("update : un rect par résultat, style de survol (fond translucide)", () => {
    const hl = createSearchHighlight();
    hl.update([makeEl(), makeEl()]);

    const rects = Array.from(
      document.querySelectorAll<HTMLElement>("[data-pathpicker-ignore] > *"),
    );
    expect(rects).toHaveLength(2);
    expect(rects[0]!.style.background).toBe("rgba(59, 130, 246, 0.15)");
    expect(rects[0]!.style.display).toBe("block");
    hl.destroy();
  });

  it("setActive : seul l'actif porte le rect net (SELECTED_BG)", () => {
    const hl = createSearchHighlight();
    hl.update([makeEl(), makeEl()]);
    hl.setActive(1);

    const rects = Array.from(
      document.querySelectorAll<HTMLElement>("[data-pathpicker-ignore] > *"),
    );
    expect(rects[0]!.style.background).toBe("rgba(59, 130, 246, 0.15)");
    expect(rects[1]!.style.background).toBe("rgba(59, 130, 246, 0.24)");
    hl.destroy();
  });

  it("update réutilise les rects (pas de duplication au refetch)", () => {
    const hl = createSearchHighlight();
    hl.update([makeEl(), makeEl(), makeEl()]);
    hl.update([makeEl(), makeEl()]);

    const rects = Array.from(
      document.querySelectorAll<HTMLElement>("[data-pathpicker-ignore] > *"),
    );
    expect(rects).toHaveLength(3);
    expect(rects[2]!.style.display).toBe("none");
    hl.destroy();
  });

  it("clear : plus aucun rect visible, la couche reste", () => {
    const hl = createSearchHighlight();
    hl.update([makeEl()]);
    hl.clear();

    expect(document.querySelector<HTMLElement>("[data-pathpicker-ignore]")).not.toBeNull();
    const rects = Array.from(
      document.querySelectorAll<HTMLElement>("[data-pathpicker-ignore] > *"),
    );
    expect(rects.every((r) => r.style.display === "none")).toBe(true);
    hl.destroy();
  });

  it("destroy : arrête la boucle rAF (plus de redraw)", async () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const hl = createSearchHighlight();
    hl.update([makeEl()]);
    hl.destroy();
    const atDestroy = rafSpy.mock.calls.length;
    await new Promise((r) => setTimeout(r, 20));
    expect(rafSpy.mock.calls.length).toBe(atDestroy);
  });
});
