import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  fetchSettings,
  loadSettings,
  saveSettings,
} from "../src/core/settings";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("loadSettings", () => {
  it("défauts quand rien n'est stocké", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("lit localStorage (merge profond sur les défauts)", () => {
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ commands: { source: { modifier: "meta" } } }),
    );
    expect(loadSettings().commands).toEqual({
      ...DEFAULT_SETTINGS.commands,
      source: { modifier: "meta", trigger: "click" },
    });
  });

  it("le fichier racine (env) a priorité sur localStorage", () => {
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ commands: { arm: "off" } }),
    );
    vi.stubEnv(
      "NEXT_PUBLIC_RENDER_PICKER_CONFIG",
      JSON.stringify({ commands: { usage: { trigger: "dblclick" } } }),
    );
    expect(loadSettings().commands).toEqual({
      ...DEFAULT_SETTINGS.commands,
      usage: { modifier: "alt", trigger: "dblclick" },
    });
  });
});

describe("saveSettings", () => {
  it("écrit localStorage + POST la route (pas de warn si ok)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    saveSettings({
      commands: { ...DEFAULT_SETTINGS.commands, arm: "ctrl ctrl" },
    });
    await Promise.resolve();

    const raw = window.localStorage.getItem("render-picker:settings");
    expect(raw && JSON.parse(raw).commands.arm).toBe("ctrl ctrl");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/render-picker",
      expect.objectContaining({ method: "POST" }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("prévient si la route répond non-ok (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    saveSettings(DEFAULT_SETTINGS);
    await Promise.resolve();
    await Promise.resolve();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("app/api/render-picker/route.ts");
  });
});

describe("fetchSettings", () => {
  it("lit la route et merge sur les défauts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ commands: { arm: "alt alt" } }),
      }),
    );
    expect((await fetchSettings())?.commands).toEqual({
      ...DEFAULT_SETTINGS.commands,
      arm: "alt alt",
    });
  });

  it("null si pas de `commands` dans la réponse", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    expect(await fetchSettings()).toBeNull();
  });

  it("null si la route est absente / échoue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no route")));
    expect(await fetchSettings()).toBeNull();
  });

  it("null si réponse non-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchSettings()).toBeNull();
  });
});
