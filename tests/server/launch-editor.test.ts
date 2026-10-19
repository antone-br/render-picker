import { afterEach, describe, expect, it, vi } from "vitest";

import {
  editorArgs,
  findRunningEditor,
  launchEditor,
  resetEditorCache,
  type LaunchDeps,
} from "../../src/server/launch-editor";

afterEach(() => {
  resetEditorCache();
});

/** Dépendances système factices : rien n'est réellement lancé. */
function fakeDeps(over: Partial<LaunchDeps> = {}): LaunchDeps & {
  start: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  listProcesses: ReturnType<typeof vi.fn>;
} {
  return {
    platform: "win32",
    listProcesses: vi.fn(async () => [] as string[]),
    start: vi.fn(async () => false),
    run: vi.fn(async () => false),
    exists: () => true,
    ...over,
  } as never;
}

describe("editorArgs", () => {
  it("famille VS Code : -r -g fichier:ligne[:col]", () => {
    expect(editorArgs("vscode", "C:/p/a.tsx", "42")).toEqual(["-r", "-g", "C:/p/a.tsx:42"]);
    expect(editorArgs("cursor", "C:/p/a.tsx", "42", "7")).toEqual(["-r", "-g", "C:/p/a.tsx:42:7"]);
  });

  it("Zed : fichier:ligne:col", () => {
    expect(editorArgs("zed", "/p/a.tsx", "3", "1")).toEqual(["/p/a.tsx:3:1"]);
  });

  it("JetBrains : --line N [--column C] fichier", () => {
    expect(editorArgs("webstorm", "C:/p/a.tsx", "42")).toEqual(["--line", "42", "C:/p/a.tsx"]);
    expect(editorArgs("phpstorm", "C:/p/a.tsx", "42", "7")).toEqual([
      "--line",
      "42",
      "--column",
      "7",
      "C:/p/a.tsx",
    ]);
  });

  it("sans ligne : fichier seul", () => {
    expect(editorArgs("vscode", "C:/p/a.tsx")).toEqual(["-r", "-g", "C:/p/a.tsx"]);
    expect(editorArgs("idea", "C:/p/a.tsx")).toEqual(["C:/p/a.tsx"]);
  });
});

describe("findRunningEditor", () => {
  const procs = [
    "C:\\Windows\\explorer.exe",
    "C:\\Program Files\\JetBrains\\WebStorm 2026.2\\bin\\webstorm64.exe",
    "C:\\Users\\a\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
  ];

  it("retrouve l'exécutable de l'IDE lancé (insensible à la casse)", () => {
    expect(findRunningEditor("webstorm", procs)).toBe(procs[1]);
    expect(findRunningEditor("vscode", procs)).toBe(procs[2]);
  });

  it("IDE non lancé → null", () => {
    expect(findRunningEditor("phpstorm", procs)).toBeNull();
  });
});

describe("launchEditor", () => {
  it("Windows : lance l'exécutable de l'IDE déjà ouvert, sans config système", async () => {
    const exe = "C:\\JetBrains\\PhpStorm\\bin\\phpstorm64.exe";
    const deps = fakeDeps({
      listProcesses: vi.fn(async () => ["C:\\x\\other.exe", exe]),
      start: vi.fn(async (cmd: string) => cmd === exe),
    });

    await expect(launchEditor("phpstorm", "C:/p/a.tsx", "42", undefined, deps)).resolves.toBe(true);
    expect(deps.start).toHaveBeenCalledWith(exe, ["--line", "42", "C:/p/a.tsx"]);
  });

  it("Windows : chemin mis en cache (pas de 2ᵉ liste des process)", async () => {
    const exe = "C:\\Code\\Code.exe";
    const deps = fakeDeps({
      listProcesses: vi.fn(async () => [exe]),
      start: vi.fn(async (cmd: string) => cmd === exe),
    });

    await launchEditor("vscode", "C:/p/a.tsx", "1", undefined, deps);
    await launchEditor("vscode", "C:/p/b.tsx", "2", undefined, deps);
    expect(deps.listProcesses).toHaveBeenCalledTimes(1);
    expect(deps.start).toHaveBeenLastCalledWith(exe, ["-r", "-g", "C:/p/b.tsx:2"]);
  });

  it("IDE non lancé → essaie la CLI du PATH", async () => {
    const deps = fakeDeps({ start: vi.fn(async (cmd: string) => cmd === "cursor") });

    await expect(launchEditor("cursor", "C:/p/a.tsx", "3", undefined, deps)).resolves.toBe(true);
    expect(deps.start).toHaveBeenCalledWith("cursor", ["-r", "-g", "C:/p/a.tsx:3"]);
  });

  it("macOS JetBrains : open -na <App>.app --args …", async () => {
    const deps = fakeDeps({
      platform: "darwin",
      run: vi.fn(async (_cmd: string, args: string[]) => args[1] === "IntelliJ IDEA CE.app"),
    });

    await expect(launchEditor("idea", "/p/a.tsx", "5", undefined, deps)).resolves.toBe(true);
    expect(deps.run).toHaveBeenLastCalledWith("open", [
      "-na",
      "IntelliJ IDEA CE.app",
      "--args",
      "--line",
      "5",
      "/p/a.tsx",
    ]);
    expect(deps.listProcesses).not.toHaveBeenCalled();
  });

  it("rien ne marche → false (le navigateur retombe sur le lien d'URL)", async () => {
    await expect(launchEditor("webstorm", "C:/p/a.tsx", "1", undefined, fakeDeps())).resolves.toBe(
      false,
    );
  });
});
