import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { RenderPickerButton, formatResult, formatResults } from "../src/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const result = {
  origin: "http://localhost:3000",
  project: "my-app",
  route: "/",
  xpath: "/html/body/main",
  cssSelector: "main",
  tagName: "main",
  id: null,
  textContent: "",
  reactComponent: "Page",
  reactSource: "src/app/page.tsx:10",
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("formatResult / formatResults", () => {
  it("préfixe [renderPicker] pour un résultat", () => {
    expect(formatResult(result)).toBe(
      "[renderPicker], Origin: http://localhost:3000, Project: my-app, Route: /, XPath: /html/body/main, CSS: main, React: Page (src/app/page.tsx:10)",
    );
  });

  it("préfixe [renderPicker] sur l'en-tête multi", () => {
    const text = formatResults([result, { ...result, xpath: "/html/body/nav" }]);
    expect(text.startsWith("[renderPicker] 2 elements")).toBe(true);
    expect(text).not.toContain("xPathInfo");
  });
});

describe("RenderPickerButton", () => {
  it("renomme le title du bouton", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<RenderPickerButton pathname="/" />));

    const title = container
      .querySelector("[data-pathpicker-toggle]")
      ?.getAttribute("title");
    expect(title).toMatch(/^renderPicker: pick an element to copy/);
    act(() => root.unmount());
  });
});
