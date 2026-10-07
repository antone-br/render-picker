import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  fetchSettings,
  initSettingsRefresh,
  loadSettings,
  refreshSettings,
  resetSettingsRouteCache,
  saveSettings,
  settingsDelta,
} from "../src/core/settings";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetSettingsRouteCache();
});

describe("settingsDelta", () => {
  it("vide quand tout vaut les défauts", () => {
    expect(settingsDelta(DEFAULT_SETTINGS)).toEqual({});
  });

  it("patch minimal : un seul binding changé", () => {
    const delta = settingsDelta({
      ...DEFAULT_SETTINGS,
      commands: {
        ...DEFAULT_SETTINGS.commands,
        source: { modifier: "shift", trigger: "click" },
      },
    });
    expect(delta).toEqual({
      commands: { source: { modifier: "shift", trigger: "click" } },
    });
  });

  it("inclut panel.width modifié", () => {
    const delta = settingsDelta({
      ...DEFAULT_SETTINGS,
      panel: { width: 738, height: 320 },
    });
    expect(delta).toEqual({ panel: { width: 738, height: 320 } });
  });

  it("round-trip : merge(défauts, delta) = settings", () => {
    const settings: typeof DEFAULT_SETTINGS = {
      ...DEFAULT_SETTINGS,
      commands: {
        ...DEFAULT_SETTINGS.commands,
        arm: "alt alt",
        usage: { modifier: "meta", trigger: "rightclick" },
      },
      panel: { width: 500, height: 400 },
    };
    // Merge via loadSettings (cache route alimenté par le delta).
    window.localStorage.setItem("render-picker:settings", JSON.stringify(settingsDelta(settings)));
    expect(loadSettings()).toEqual(settings);
  });
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

  it("merge panel.width (largeur du panneau)", () => {
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ panel: { width: 600 } }),
    );
    expect(loadSettings().panel.width).toBe(600);
    expect(loadSettings().commands.arm).toBe("shift shift");
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
      usage: { modifier: "ctrl", trigger: "dblclick" },
    });
  });
});

describe("saveSettings", () => {
  it("écrit le DELTA en localStorage + POST le delta (pas de warn si ok)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    saveSettings({
      ...DEFAULT_SETTINGS,
      commands: { ...DEFAULT_SETTINGS.commands, arm: "ctrl ctrl" },
    });
    await Promise.resolve();

    const raw = window.localStorage.getItem("render-picker:settings");
    expect(raw && JSON.parse(raw)).toEqual({ commands: { arm: "ctrl ctrl" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/render-picker",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ commands: { arm: "ctrl ctrl" } }),
      }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("delta vide : clé localStorage supprimée + POST `{}`", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ commands: { arm: "off" } }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    saveSettings(DEFAULT_SETTINGS);
    await Promise.resolve();

    expect(window.localStorage.getItem("render-picker:settings")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/render-picker",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("write-through : après POST ok, loadSettings reflète le delta (sans focus)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    saveSettings({
      ...DEFAULT_SETTINGS,
      commands: {
        ...DEFAULT_SETTINGS.commands,
        source: { modifier: "shift", trigger: "click" },
      },
    });
    await Promise.resolve();

    expect(loadSettings().commands.source).toEqual({
      modifier: "shift",
      trigger: "click",
    });
  });

  it("route non-ok : delta écrit en localStorage, fallback dessus (pas de cache route)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    saveSettings({
      ...DEFAULT_SETTINGS,
      commands: { ...DEFAULT_SETTINGS.commands, arm: "alt alt" },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(warn).toHaveBeenCalledTimes(1);
    // Pas de write-through : loadSettings retombe sur le localStorage (delta).
    expect(loadSettings().commands.arm).toBe("alt alt");
    // Le défaut de l'env n'a pas pu être écrasé par le cache route :
    // on neutralise localStorage pour le vérifier.
    window.localStorage.clear();
    expect(loadSettings().commands.arm).toBe("shift shift");
  });

  it("prévient si la route répond non-ok (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    saveSettings({
      ...DEFAULT_SETTINGS,
      commands: { ...DEFAULT_SETTINGS.commands, arm: "ctrl ctrl" },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("app/api/render-picker/route.ts");
  });
});

describe("loadSettings + cache route (live-reload)", () => {
  it("le cache route a priorité sur l'env ET localStorage", async () => {
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ commands: { arm: "off" } }),
    );
    vi.stubEnv(
      "NEXT_PUBLIC_RENDER_PICKER_CONFIG",
      JSON.stringify({ commands: { usage: { trigger: "dblclick" } } }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          commands: { copy: { modifier: "meta", trigger: "click" } },
        }),
      }),
    );

    await refreshSettings();

    expect(loadSettings().commands.copy).toEqual({
      modifier: "meta",
      trigger: "click",
    });
    // env et localStorage écrasés
    expect(loadSettings().commands.usage).toEqual({
      modifier: "ctrl",
      trigger: "click",
    });
    expect(loadSettings().commands.arm).toBe("shift shift");
  });

  it("fichier `{}` = pas de config → retombe sur env/localStorage", async () => {
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ commands: { arm: "alt alt" } }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    await refreshSettings();

    expect(loadSettings().commands.arm).toBe("alt alt");
  });

  it("route absente : pas de cache, fallback inchangé", async () => {
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ commands: { arm: "alt alt" } }),
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no route")));

    await refreshSettings();

    expect(loadSettings().commands.arm).toBe("alt alt");
  });

  it("initSettingsRefresh : refetch au focus, listeners partagés", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ commands: { arm: "ctrl ctrl" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const stop1 = initSettingsRefresh();
    const stop2 = initSettingsRefresh();
    await vi.waitFor(() => expect(loadSettings().commands.arm).toBe("ctrl ctrl"));
    const afterInit = fetchMock.mock.calls.length;

    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(afterInit));

    stop1();
    // Un init reste actif : le focus fetch encore (listeners partagés).
    const afterStop1 = fetchMock.mock.calls.length;
    window.dispatchEvent(new Event("focus"));
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(afterStop1);

    // Tous les init arrêtés : plus de fetch au focus.
    const beforeStop2 = fetchMock.mock.calls.length;
    stop2();
    window.dispatchEvent(new Event("focus"));
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock.mock.calls.length).toBe(beforeStop2);
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

describe("commandes search / inspect (binding clavier)", () => {
  it("défauts : search = Ctrl + double-tap F, inspect = Ctrl + I simple", () => {
    expect(DEFAULT_SETTINGS.commands.search).toEqual({
      modifier: "ctrl",
      key: "f",
      double: true,
    });
    expect(DEFAULT_SETTINGS.commands.inspect).toEqual({
      modifier: "ctrl",
      key: "i",
      double: false,
    });
  });

  it("merge normalise un legacy string (`search: \"p\"` → objet, double false)", () => {
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ commands: { search: "p", inspect: "d" } }),
    );
    expect(loadSettings().commands.search).toEqual({
      modifier: "ctrl",
      key: "p",
      double: false,
    });
    expect(loadSettings().commands.inspect).toEqual({
      modifier: "ctrl",
      key: "d",
      double: false,
    });
  });

  it("merge objet partiel : complète les champs manquants depuis les défauts", () => {
    window.localStorage.setItem(
      "render-picker:settings",
      JSON.stringify({ commands: { search: { modifier: "alt" } } }),
    );
    expect(loadSettings().commands.search).toEqual({
      modifier: "alt",
      key: "f",
      double: true,
    });
  });

  it("settingsDelta : binding search modifié (modifier/key/double)", () => {
    const delta = settingsDelta({
      ...DEFAULT_SETTINGS,
      commands: {
        ...DEFAULT_SETTINGS.commands,
        search: { modifier: "alt", key: "p", double: false },
      },
    });
    expect(delta).toEqual({
      commands: { search: { modifier: "alt", key: "p", double: false } },
    });
  });

  it("settingsDelta : vide si le binding égale le défaut (même double-tap)", () => {
    const delta = settingsDelta({
      ...DEFAULT_SETTINGS,
      commands: {
        ...DEFAULT_SETTINGS.commands,
        search: { modifier: "ctrl", key: "f", double: true },
      },
    });
    expect(delta).toEqual({});
  });
});
