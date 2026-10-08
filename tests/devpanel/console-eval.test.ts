import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runConsoleExpression } from "../../src/core/devpanel/console-eval";

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).__rpTest;
});

describe("runConsoleExpression", () => {
  it("écho de la saisie puis résultat", () => {
    runConsoleExpression("1 + 1");
    expect(logSpy).toHaveBeenNthCalledWith(1, "› 1 + 1");
    expect(logSpy).toHaveBeenNthCalledWith(2, 2);
  });

  it("évalue en portée globale (window)", () => {
    runConsoleExpression("globalThis.__rpTest = 7; __rpTest");
    expect(logSpy).toHaveBeenLastCalledWith(7);
  });

  it("erreur (ReferenceError) → console.error", () => {
    runConsoleExpression("nopeNotDefined()");
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  it("promesse résolue → loggée après microtask", async () => {
    runConsoleExpression("Promise.resolve(5)");
    await Promise.resolve();
    expect(logSpy).toHaveBeenCalledWith("⟵", 5);
  });

  it("promesse rejetée → console.error après microtask", async () => {
    runConsoleExpression("Promise.reject(new Error('boom'))");
    await Promise.resolve();
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  it("vide / espaces → aucun appel", () => {
    runConsoleExpression("   ");
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });
});
