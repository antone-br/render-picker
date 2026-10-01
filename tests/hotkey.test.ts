import { describe, expect, it } from "vitest";

import { createHotkeyMatcher, matchesHotkey } from "../src/core/inspector/hotkey";

/** Fabrique un KeyboardEvent minimal (on ne lit que ces champs). */
function ev(opts: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    repeat: false,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    timeStamp: 0,
    code: "",
    ...opts,
  } as KeyboardEvent;
}

describe("matchesHotkey", () => {
  it("combo exact ctrl+p", () => {
    expect(matchesHotkey(ev({ key: "p", code: "KeyP", ctrlKey: true }), "ctrl+p")).toBe(
      true,
    );
  });

  it("modificateurs exacts : ctrl+p ne matche pas ctrl+shift+p", () => {
    expect(
      matchesHotkey(ev({ key: "p", code: "KeyP", ctrlKey: true, shiftKey: true }), "ctrl+p"),
    ).toBe(false);
  });

  it("alias option→alt, command→meta", () => {
    expect(matchesHotkey(ev({ key: "k", code: "KeyK", altKey: true }), "option+k")).toBe(
      true,
    );
    expect(matchesHotkey(ev({ key: "k", code: "KeyK", metaKey: true }), "command+k")).toBe(
      true,
    );
  });
});

describe("createHotkeyMatcher — double-tap", () => {
  it("double-tap Shift dans la fenêtre → arm", () => {
    const m = createHotkeyMatcher("shift shift");
    expect(m.onKeyDown(ev({ key: "Shift", shiftKey: true, timeStamp: 0 }))).toBeNull();
    m.onKeyUp(ev({ key: "Shift", shiftKey: false, timeStamp: 10 }));
    expect(m.onKeyDown(ev({ key: "Shift", shiftKey: true, timeStamp: 100 }))).toBe("arm");
  });

  it("hors fenêtre → pas d'arm", () => {
    const m = createHotkeyMatcher("shift shift");
    m.onKeyDown(ev({ key: "Shift", shiftKey: true, timeStamp: 0 }));
    m.onKeyUp(ev({ key: "Shift", shiftKey: false, timeStamp: 10 }));
    expect(m.onKeyDown(ev({ key: "Shift", shiftKey: true, timeStamp: 500 }))).toBeNull();
  });

  it("un autre modificateur tenu annule le tap", () => {
    const m = createHotkeyMatcher("shift shift");
    m.onKeyDown(ev({ key: "Shift", shiftKey: true, timeStamp: 0 }));
    m.onKeyUp(ev({ key: "Shift", shiftKey: false, timeStamp: 10 }));
    // deuxième tap avec Ctrl tenu → ignoré
    expect(
      m.onKeyDown(ev({ key: "Shift", shiftKey: true, ctrlKey: true, timeStamp: 100 })),
    ).toBeNull();
  });

  it("reset() repart de zéro", () => {
    const m = createHotkeyMatcher("shift shift");
    m.onKeyDown(ev({ key: "Shift", shiftKey: true, timeStamp: 0 }));
    m.onKeyUp(ev({ key: "Shift", shiftKey: false, timeStamp: 10 }));
    m.reset();
    expect(m.onKeyDown(ev({ key: "Shift", shiftKey: true, timeStamp: 100 }))).toBeNull();
  });
});

describe("createHotkeyMatcher — combo", () => {
  it("combo → toggle au keydown", () => {
    const m = createHotkeyMatcher("ctrl+p");
    expect(m.onKeyDown(ev({ key: "p", code: "KeyP", ctrlKey: true }))).toBe("toggle");
  });

  it("false → jamais d'action", () => {
    const m = createHotkeyMatcher(false);
    expect(m.onKeyDown(ev({ key: "Shift", shiftKey: true, timeStamp: 0 }))).toBeNull();
  });

  it("specs multiples séparées par ,", () => {
    const m = createHotkeyMatcher("shift shift, ctrl+p");
    expect(m.onKeyDown(ev({ key: "p", code: "KeyP", ctrlKey: true }))).toBe("toggle");
  });
});
