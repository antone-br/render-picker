import { afterEach, describe, expect, it, vi } from "vitest";

import { initConsoleCapture } from "../../src/core/devpanel/console-capture";
import type { LogEntry } from "../../src/core/devpanel/store";

afterEach(() => vi.restoreAllMocks());

describe("initConsoleCapture", () => {
  it("capture les console.* (texte sérialisé) et délègue à l'original", () => {
    const original = vi.spyOn(console, "log").mockImplementation(() => {});
    const entries: LogEntry[] = [];
    const stop = initConsoleCapture((e) => entries.push(e));

    console.log("hello", { a: 1 });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe("log");
    expect(entries[0]!.text).toBe('hello {"a":1}');
    expect(original).toHaveBeenCalledWith("hello", { a: 1 });

    stop();
  });

  it("restaure les originaux au cleanup", () => {
    const before = console.error;
    const stop = initConsoleCapture(() => {});
    expect(console.error).not.toBe(before);
    stop();
    expect(console.error).toBe(before);
  });
});
