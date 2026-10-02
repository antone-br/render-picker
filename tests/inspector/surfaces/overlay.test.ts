import { afterEach, describe, expect, it } from "vitest";

import { createSurfaces } from "../../../src/core/inspector/surfaces/create";
import { positionOverlay } from "../../../src/core/inspector/surfaces/overlay";
import { OVERLAY_GLIDE } from "../../../src/core/inspector/constants/picker";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("positionOverlay", () => {
  const rect = { top: 10, left: 20, width: 100, height: 40 } as DOMRect;

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
