import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveProjectRoot } from "../../src/core/dev/project-root";

describe("resolveProjectRoot", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as unknown as { renderPickerRoot?: string }).renderPickerRoot;
    document.head.innerHTML = "";
  });
  afterEach(() => {
    localStorage.clear();
    delete (window as unknown as { renderPickerRoot?: string }).renderPickerRoot;
    document.head.innerHTML = "";
  });

  it("localStorage prioritaire sur jsDef et meta", () => {
    localStorage.setItem("renderPickerRoot", "C:/host/public_html");
    (window as unknown as { renderPickerRoot?: string }).renderPickerRoot = "/var/www/html";
    expect(resolveProjectRoot(window, document)).toEqual({
      root: "C:/host/public_html",
      source: "localStorage",
    });
  });

  it("jsDef (window.renderPickerRoot) si pas de localStorage", () => {
    (window as unknown as { renderPickerRoot?: string }).renderPickerRoot = "/var/www/html";
    expect(resolveProjectRoot(window, document)).toEqual({
      root: "/var/www/html",
      source: "jsDef",
    });
  });

  it("meta en dernier recours", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "render-picker-root");
    meta.setAttribute("content", "/srv/app");
    document.head.appendChild(meta);
    expect(resolveProjectRoot(window, document)).toEqual({
      root: "/srv/app",
      source: "meta",
    });
  });

  it("source 'none' si rien de configuré", () => {
    expect(resolveProjectRoot(window, document)).toEqual({ root: undefined, source: "none" });
  });
});
