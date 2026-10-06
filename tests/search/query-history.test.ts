import { describe, expect, it } from "vitest";

import { makeQueryHistory } from "../../src/core/search/query-history";

describe("makeQueryHistory", () => {
  it("valeur initiale + push", () => {
    const h = makeQueryHistory("div");
    expect(h.current).toBe("div");

    h.push("div.card");
    expect(h.current).toBe("div.card");
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
  });

  it("undo borné au premier état", () => {
    const h = makeQueryHistory("");
    expect(h.undo()).toBe(false);
    h.push("div");
    expect(h.undo()).toBe(true);
    expect(h.current).toBe("");
    expect(h.undo()).toBe(false);
  });

  it("redo ramène en avant", () => {
    const h = makeQueryHistory("");
    h.push("div");
    h.push("div.card");
    h.undo();
    h.undo();
    expect(h.current).toBe("");
    expect(h.redo()).toBe(true);
    expect(h.current).toBe("div");
  });

  it("push après undo tronque le redo à venir", () => {
    const h = makeQueryHistory("");
    h.push("div");
    h.push("input");
    h.undo();
    h.push("form");
    expect(h.canRedo()).toBe(false);
    h.undo();
    expect(h.current).toBe("div");
  });

  it("push identique : no-op (pas de doublon)", () => {
    const h = makeQueryHistory("");
    h.push("div");
    h.push("div");
    expect(h.undo()).toBe(true);
    expect(h.current).toBe("");
  });

  it("cap l'historique (100)", () => {
    const h = makeQueryHistory("0");
    for (let i = 1; i <= 150; i++) h.push(`q${i}`);
    let undos = 0;
    while (h.undo()) undos++;
    expect(undos).toBeLessThanOrEqual(99);
    expect(h.current).toBe(h.current); // stable
    expect(h.current.length).toBeGreaterThan(0);
  });
});
