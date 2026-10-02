import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST, withRenderPicker } from "../src/next";

// Vrai fs dans un dossier temp (cwd stubbé) — pas de mock fragile, pas de pollution.
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rp-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  vi.stubEnv("NODE_ENV", "development");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("route dev GET/POST", () => {
  it("GET renvoie {} si le fichier est absent", async () => {
    await expect(GET().json()).resolves.toEqual({});
  });

  it("POST écrit render-picker.config.json puis GET le relit", async () => {
    const overlays = { padding: true, gap: false, margin: true };
    const res = await POST(
      new Request("http://x/api/render-picker", {
        method: "POST",
        body: JSON.stringify({ overlays }),
      }),
    );
    expect(res.status).toBe(200);

    // Fichier réellement écrit à la racine (cwd).
    const onDisk = JSON.parse(
      readFileSync(join(dir, "render-picker.config.json"), "utf8"),
    );
    expect(onDisk).toEqual({ overlays });
    await expect(GET().json()).resolves.toEqual({ overlays });
  });

  it("404 en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(GET().status).toBe(404);
    const res = await POST(new Request("http://x", { method: "POST", body: "{}" }));
    expect(res.status).toBe(404);
  });
});

describe("withRenderPicker", () => {
  it("injecte NEXT_PUBLIC_PROJECT_ROOT hors prod", () => {
    const out = withRenderPicker({ env: { FOO: "bar" } }) as {
      env: Record<string, string>;
    };
    expect(out.env.NEXT_PUBLIC_PROJECT_ROOT).toBe(dir);
    expect(out.env.FOO).toBe("bar");
  });
});
