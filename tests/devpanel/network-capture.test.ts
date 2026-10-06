import { afterEach, describe, expect, it, vi } from "vitest";

import { initNetworkCapture } from "../../src/core/devpanel/network-capture";
import type { NetEntry } from "../../src/core/devpanel/store";

afterEach(() => vi.restoreAllMocks());

describe("initNetworkCapture", () => {
  it("capture fetch : statut, headers, body, type, initiator ; restaure au cleanup", async () => {
    const original = window.fetch;
    const res = new Response("hello body", {
      status: 200,
      headers: { "content-type": "text/plain", "x-res": "1" },
    });
    const fetchMock = vi.fn().mockResolvedValue(res);
    window.fetch = fetchMock as typeof window.fetch;

    const entries: NetEntry[] = [];
    const stop = initNetworkCapture((e) => entries.push(e));

    await window.fetch("/api/x", {
      method: "POST",
      headers: { authorization: "tok" },
      body: "q=1",
    });
    await vi.waitFor(() => expect(entries.length).toBe(1));

    const e = entries[0]!;
    expect(e).toMatchObject({ method: "POST", url: "/api/x", status: 200, ok: true });
    expect(e.reqHeaders).toMatchObject({ authorization: "tok" });
    expect(e.reqBody).toBe("q=1");
    expect(e.resHeaders?.["content-type"]).toBe("text/plain");
    expect(e.type).toBe("text/plain");
    expect(e.resBody).toBe("hello body");
    expect(typeof e.initiator).toBe("string");

    stop();
    expect(window.fetch).toBe(fetchMock);
    window.fetch = original;
  });

  it("capture une erreur fetch (status 0, ok false, sans body)", async () => {
    const original = window.fetch;
    window.fetch = vi.fn().mockRejectedValue(new Error("boom")) as typeof window.fetch;

    const entries: NetEntry[] = [];
    const stop = initNetworkCapture((e) => entries.push(e));

    await expect(window.fetch("/api/fail")).rejects.toThrow("boom");
    expect(entries[0]).toMatchObject({ url: "/api/fail", status: 0, ok: false });
    expect(entries[0]!.resBody).toBeUndefined();

    stop();
    window.fetch = original;
  });
});
