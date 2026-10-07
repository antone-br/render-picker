import { describe, expect, it } from "vitest";

import { createKeyCommandMatcher } from "../../src/core/inspector/key-command";
import type { SearchBinding } from "../../src/core/settings";

/** Event clavier synthétique (lit key/modificateurs/repeat/timeStamp). */
const ev = (o: {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  timeStamp?: number;
}): KeyboardEvent =>
  ({
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    timeStamp: 0,
    ...o,
  }) as KeyboardEvent;

const bind = (p: Partial<SearchBinding> = {}): SearchBinding => ({
  modifier: "ctrl",
  key: "f",
  double: true,
  ...p,
});

describe("createKeyCommandMatcher", () => {
  it("simple (double:false) : correspondance → fire immédiat", () => {
    const m = createKeyCommandMatcher();
    expect(m.status(ev({ key: "k", ctrlKey: true }), bind({ key: "k", double: false }))).toBe(
      "fire",
    );
  });

  it("double-tap : 1er appui = wait, 2e dans la fenêtre = fire", () => {
    const m = createKeyCommandMatcher();
    expect(m.status(ev({ key: "f", ctrlKey: true, timeStamp: 0 }), bind())).toBe("wait");
    expect(m.status(ev({ key: "f", ctrlKey: true, timeStamp: 100 }), bind())).toBe("fire");
  });

  it("double-tap : 2e appui hors fenêtre (>400) = wait (ré-arme)", () => {
    const m = createKeyCommandMatcher();
    expect(m.status(ev({ key: "f", ctrlKey: true, timeStamp: 0 }), bind())).toBe("wait");
    expect(m.status(ev({ key: "f", ctrlKey: true, timeStamp: 500 }), bind())).toBe("wait");
  });

  it("double-tap : timeStamp 0 valide comme 1er tap (sentinelle null)", () => {
    const m = createKeyCommandMatcher();
    m.status(ev({ key: "f", ctrlKey: true, timeStamp: 0 }), bind());
    expect(m.status(ev({ key: "f", ctrlKey: true, timeStamp: 10 }), bind())).toBe("fire");
  });

  it("auto-répétition (repeat) ne compte pas comme 2e tap", () => {
    const m = createKeyCommandMatcher();
    m.status(ev({ key: "f", ctrlKey: true, timeStamp: 0 }), bind());
    expect(m.status(ev({ key: "f", ctrlKey: true, timeStamp: 50, repeat: true }), bind())).toBe(
      "wait",
    );
  });

  it("off / mauvais modificateur / mauvaise touche → null", () => {
    const m = createKeyCommandMatcher();
    expect(m.status(ev({ key: "f", ctrlKey: true }), bind({ key: "off" }))).toBeNull();
    expect(m.status(ev({ key: "f" }), bind())).toBeNull(); // pas de Ctrl
    expect(m.status(ev({ key: "g", ctrlKey: true }), bind())).toBeNull();
  });

  it("reset() purge le tap en attente", () => {
    const m = createKeyCommandMatcher();
    m.status(ev({ key: "f", ctrlKey: true, timeStamp: 0 }), bind());
    m.reset();
    expect(m.status(ev({ key: "f", ctrlKey: true, timeStamp: 100 }), bind())).toBe("wait");
  });
});
