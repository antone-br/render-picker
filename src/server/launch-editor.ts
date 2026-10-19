import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { EDITORS, type EditorId } from "../core/dev/editors";

// Node uniquement (route dev `next.ts`). Jamais bundlé côté navigateur.

/**
 * Ouvre un fichier à une ligne dans l'IDE choisi, côté serveur dev, SANS rien
 * configurer sur la machine (pas de schéma d'URL à enregistrer, pas de Toolbox) :
 * 1. Windows : exécutable de l'IDE **déjà lancé**, lu dans la liste des process ;
 * 2. macOS (JetBrains) : `open -na "<App>.app" --args --line N <fichier>` ;
 * 3. partout : CLI de l'IDE si elle est dans le PATH.
 * Jamais de shell : l'exécutable et les arguments sont passés en tableau.
 */

/** Noms d'exécutables Windows (minuscules) d'un IDE lancé. */
const WIN_EXES: Record<EditorId, string[]> = {
  vscode: ["code.exe"],
  "vscode-insiders": ["code - insiders.exe"],
  cursor: ["cursor.exe"],
  windsurf: ["windsurf.exe"],
  vscodium: ["vscodium.exe"],
  zed: ["zed.exe"],
  webstorm: ["webstorm64.exe", "webstorm.exe"],
  phpstorm: ["phpstorm64.exe", "phpstorm.exe"],
  idea: ["idea64.exe", "idea.exe"],
  pycharm: ["pycharm64.exe", "pycharm.exe"],
};

/** Bundles macOS des IDE JetBrains (`open -na <app>`), éditions incluses. */
const MAC_APPS: Partial<Record<EditorId, string[]>> = {
  webstorm: ["WebStorm"],
  phpstorm: ["PhpStorm"],
  idea: ["IntelliJ IDEA", "IntelliJ IDEA Ultimate", "IntelliJ IDEA CE"],
  pycharm: ["PyCharm", "PyCharm Professional Edition", "PyCharm CE"],
};

/** CLI de l'IDE (si dans le PATH). */
const CLI_NAMES: Record<EditorId, string[]> = {
  vscode: ["code"],
  "vscode-insiders": ["code-insiders"],
  cursor: ["cursor"],
  windsurf: ["windsurf"],
  vscodium: ["codium", "vscodium"],
  zed: ["zed", "zeditor"],
  webstorm: ["webstorm"],
  phpstorm: ["phpstorm"],
  idea: ["idea"],
  pycharm: ["pycharm"],
};

/** Arguments « ouvrir à la ligne » selon la famille de l'IDE. Pur. */
export function editorArgs(
  editor: EditorId,
  file: string,
  line?: string,
  col?: string,
): string[] {
  const family = EDITORS.find((e) => e.id === editor)?.family ?? "vscode";
  const pos = line ? `${file}:${line}${col ? `:${col}` : ""}` : file;
  switch (family) {
    case "vscode":
      return ["-r", "-g", pos];
    case "zed":
      return [pos];
    case "jetbrains":
      return [
        ...(line ? ["--line", line] : []),
        ...(line && col ? ["--column", col] : []),
        file,
      ];
  }
}

/** Chemin de l'exécutable de l'IDE parmi les process lancés (Windows), ou `null`. Pur. */
export function findRunningEditor(editor: EditorId, processPaths: string[]): string | null {
  const names = WIN_EXES[editor];
  for (const p of processPaths) {
    const base = p.replace(/\\/g, "/").split("/").pop()?.toLowerCase();
    if (base && names.includes(base)) return p;
  }
  return null;
}

/** Effets système, injectables pour les tests. */
export interface LaunchDeps {
  platform: NodeJS.Platform;
  /** Chemins des exécutables des process en cours (Windows). */
  listProcesses: () => Promise<string[]>;
  /** Lance détaché ; `true` si le process a démarré. */
  start: (cmd: string, args: string[]) => Promise<boolean>;
  /** Lance et attend la fin ; `true` si code de sortie 0 (`open -a` sur macOS). */
  run: (cmd: string, args: string[]) => Promise<boolean>;
  exists: (path: string) => boolean;
}

const nodeDeps: LaunchDeps = {
  platform: process.platform,
  listProcesses: () =>
    new Promise((resolve) => {
      execFile(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-CimInstance Win32_Process | ForEach-Object { $_.ExecutablePath }",
        ],
        { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
        (err, stdout) => {
          if (err) return resolve([]);
          resolve(
            stdout
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean),
          );
        },
      );
    }),
  start: (cmd, args) =>
    new Promise((resolve) => {
      try {
        const child = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true });
        child.once("spawn", () => {
          child.unref();
          resolve(true);
        });
        child.once("error", () => resolve(false));
      } catch {
        resolve(false);
      }
    }),
  run: (cmd, args) =>
    new Promise((resolve) => {
      execFile(cmd, args, { windowsHide: true }, (err) => resolve(!err));
    }),
  exists: existsSync,
};

/** Exécutable Windows déjà trouvé par IDE (la liste des process coûte ~0,5 s). */
const exeCache = new Map<EditorId, string>();

/** Vide le cache des exécutables (tests). */
export function resetEditorCache(): void {
  exeCache.clear();
}

/**
 * Ouvre `file` (chemin absolu) à `line`/`col` dans `editor`. `true` si un
 * lancement a réussi ; `false` → l'appelant retombe sur le lien d'URL.
 */
export async function launchEditor(
  editor: EditorId,
  file: string,
  line?: string,
  col?: string,
  deps: LaunchDeps = nodeDeps,
): Promise<boolean> {
  const args = editorArgs(editor, file, line, col);

  if (deps.platform === "win32") {
    const cached = exeCache.get(editor);
    if (cached && deps.exists(cached) && (await deps.start(cached, args))) return true;
    exeCache.delete(editor);

    const exe = findRunningEditor(editor, await deps.listProcesses());
    if (exe && (await deps.start(exe, args))) {
      exeCache.set(editor, exe);
      return true;
    }
  }

  if (deps.platform === "darwin") {
    for (const app of MAC_APPS[editor] ?? []) {
      if (await deps.run("open", ["-na", `${app}.app`, "--args", ...args])) return true;
    }
  }

  for (const cli of CLI_NAMES[editor]) {
    if (await deps.start(cli, args)) return true;
  }
  return false;
}
