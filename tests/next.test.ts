import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST, withRenderPicker } from "../src/next";

// Lancement d'IDE simulé : la route ne doit jamais lancer de vrai process en test.
const launchEditor = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../src/server/launch-editor", () => ({ launchEditor }));

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

describe("route dev POST — ouverture dans l'IDE ({ open })", () => {
  const post = (body: unknown) =>
    POST(new Request("http://x/api/render-picker", { method: "POST", body: JSON.stringify(body) }));

  beforeEach(() => {
    launchEditor.mockReset();
    launchEditor.mockResolvedValue(true);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "a.tsx"), "x");
  });

  it("ouvre le fichier (chemin absolu, ligne/colonne) sans écrire la config", async () => {
    const res = await post({ open: { editor: "webstorm", source: "src/a.tsx:42:7" } });
    expect(res.status).toBe(200);
    expect(launchEditor).toHaveBeenCalledWith("webstorm", join(dir, "src", "a.tsx"), "42", "7");
    expect(() => readFileSync(join(dir, "render-picker.config.json"), "utf8")).toThrow();
  });

  it("éditeur inconnu / source absente → 400", async () => {
    expect((await post({ open: { editor: "notepad", source: "src/a.tsx:1" } })).status).toBe(400);
    expect((await post({ open: { editor: "vscode" } })).status).toBe(400);
    expect(launchEditor).not.toHaveBeenCalled();
  });

  it("chemin hors du projet → 403", async () => {
    const res = await post({ open: { editor: "vscode", source: "../../etc/passwd:1" } });
    expect(res.status).toBe(403);
    expect(launchEditor).not.toHaveBeenCalled();
  });

  it("fichier inexistant → 404", async () => {
    expect((await post({ open: { editor: "vscode", source: "src/nope.tsx:1" } })).status).toBe(404);
  });

  it("IDE introuvable → 500 (le navigateur retombe sur le lien d'URL)", async () => {
    launchEditor.mockResolvedValue(false);
    expect((await post({ open: { editor: "idea", source: "src/a.tsx:1" } })).status).toBe(500);
  });

  it("no-op en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await post({ open: { editor: "vscode", source: "src/a.tsx:1" } })).status).toBe(404);
    expect(launchEditor).not.toHaveBeenCalled();
  });
});
