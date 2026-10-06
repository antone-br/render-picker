import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addLog,
  addRequest,
  clearLogs,
  clearRequests,
  getState,
  subscribe,
} from "../../src/core/devpanel/store";

afterEach(() => {
  clearLogs();
  clearRequests();
  vi.restoreAllMocks();
});

const log = (text: string) => ({ level: "log" as const, text, ts: 0 });
const req = (url: string) => ({
  method: "GET",
  url,
  status: 200,
  ok: true,
  durationMs: 1,
  ts: 0,
});

describe("devpanel store", () => {
  it("addLog / addRequest alimentent getState", () => {
    addLog(log("a"));
    addRequest(req("/x"));
    expect(getState().logs.map((l) => l.text)).toEqual(["a"]);
    expect(getState().requests.map((r) => r.url)).toEqual(["/x"]);
  });

  it("clear vide chaque buffer", () => {
    addLog(log("a"));
    addRequest(req("/x"));
    clearLogs();
    expect(getState().logs).toHaveLength(0);
    expect(getState().requests).toHaveLength(1);
    clearRequests();
    expect(getState().requests).toHaveLength(0);
  });

  it("borne à 500 entrées (ring)", () => {
    for (let i = 0; i < 520; i++) addLog(log(`#${i}`));
    const { logs } = getState();
    expect(logs).toHaveLength(500);
    expect(logs[0]!.text).toBe("#20");
    expect(logs.at(-1)!.text).toBe("#519");
  });

  it("subscribe notifie et se désabonne", () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    addLog(log("a"));
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    addLog(log("b"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
