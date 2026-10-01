import { afterEach, describe, expect, it } from "vitest";

import { hudText, tooltipText } from "../src/core/inspector/surfaces";

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
