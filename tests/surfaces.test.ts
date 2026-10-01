import { afterEach, describe, expect, it } from "vitest";

import {
  createSurfaces,
  hudText,
  positionOverlay,
  tooltipText,
} from "../src/core/inspector/surfaces";
import { OVERLAY_GLIDE } from "../src/core/inspector/pick-style";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("tooltipText", () => {
  it("balise + classes retenues (hash ignorées), 3 max", () => {
    document.body.innerHTML = `<div class="flex css-1a2b3c gap-4 p-2 m-1"></div>`;
    const el = document.querySelector("div")!;
    expect(tooltipText(el, [])).toBe("<div.flex.gap-4.p-2>");
  });

  it("marque · disabled", () => {
    document.body.innerHTML = `<button disabled></button>`;
    const el = document.querySelector("button")!;
    expect(tooltipText(el, [])).toBe("<button> · disabled");
  });

  it("marque · selected #n selon la position dans la sélection", () => {
    document.body.innerHTML = `<span></span><span></span>`;
    const [a, b] = Array.from(document.querySelectorAll("span"));
    expect(tooltipText(b!, [a!, b!])).toBe("<span> · selected #2");
  });
});

describe("hudText", () => {
  it("affiche uniquement Esc to cancel", () => {
    expect(hudText()).toBe("Esc to cancel");
  });
});

describe("positionOverlay", () => {
  const rect = {
    top: 10,
    left: 20,
    width: 100,
    height: 40,
  } as DOMRect;

  it("positionne + affiche, glisse actif par défaut", () => {
    const { overlay } = createSurfaces();
    positionOverlay(overlay, rect);
    expect(overlay.style.opacity).toBe("1");
    expect(overlay.style.top).toBe("10px");
    expect(overlay.style.left).toBe("20px");
    expect(overlay.style.width).toBe("100px");
    expect(overlay.style.height).toBe("40px");
    expect(overlay.style.transition).toBe(OVERLAY_GLIDE);
  });

  it("animate=false : positionne instantanément puis réactive le glisse", () => {
    const { overlay } = createSurfaces();
    positionOverlay(overlay, rect, false);
    expect(overlay.style.top).toBe("10px");
    expect(overlay.style.opacity).toBe("1");
    expect(overlay.style.transition).toBe(OVERLAY_GLIDE);
  });
});
