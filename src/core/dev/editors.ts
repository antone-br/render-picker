/**
 * Registre des éditeurs supportés par l'ouverture de source (Alt/Ctrl+clic) et
 * construction de leur URI. Pur, sans DOM — testable.
 *
 * Trois formats d'URL :
 * - famille VS Code : `<scheme>://file/<abs>:<ligne>[:<col>]` ;
 * - Zed : `zed://file/<abs>:<ligne>[:<col>]` ;
 * - JetBrains : `<scheme>://open?file=<abs>&line=<ligne>[&column=<col>]`
 *   (schéma enregistré par l'IDE / JetBrains Toolbox).
 */

/** Identifiant d'éditeur (valeur persistée dans `commands.editor`). */
export type EditorId =
  | "vscode"
  | "vscode-insiders"
  | "cursor"
  | "windsurf"
  | "vscodium"
  | "zed"
  | "webstorm"
  | "phpstorm"
  | "idea"
  | "pycharm";

type EditorFamily = "vscode" | "zed" | "jetbrains";

export interface EditorInfo {
  id: EditorId;
  /** Libellé affiché dans le dropdown. */
  label: string;
  /** Schéma d'URL enregistré par l'éditeur. */
  scheme: string;
  family: EditorFamily;
}

/** Éditeurs proposés, dans l'ordre du dropdown. */
export const EDITORS: readonly EditorInfo[] = [
  { id: "vscode", label: "VS Code", scheme: "vscode", family: "vscode" },
  { id: "vscode-insiders", label: "VS Code Insiders", scheme: "vscode-insiders", family: "vscode" },
  { id: "cursor", label: "Cursor", scheme: "cursor", family: "vscode" },
  { id: "windsurf", label: "Windsurf", scheme: "windsurf", family: "vscode" },
  { id: "vscodium", label: "VSCodium", scheme: "vscodium", family: "vscode" },
  { id: "zed", label: "Zed", scheme: "zed", family: "zed" },
  { id: "webstorm", label: "WebStorm", scheme: "webstorm", family: "jetbrains" },
  { id: "phpstorm", label: "PhpStorm", scheme: "phpstorm", family: "jetbrains" },
  { id: "idea", label: "IntelliJ IDEA", scheme: "idea", family: "jetbrains" },
  { id: "pycharm", label: "PyCharm", scheme: "pycharm", family: "jetbrains" },
];

/** Éditeur par défaut. */
export const DEFAULT_EDITOR: EditorId = "vscode";

/** Vrai si `value` est un identifiant d'éditeur connu (config lue d'un JSON). */
export function isEditorId(value: unknown): value is EditorId {
  return typeof value === "string" && EDITORS.some((e) => e.id === value);
}

/** `src/a.tsx:42:7` → `{ file, line, col }` (ligne / colonne optionnelles). Pur. */
export function parseSource(source: string): { file: string; line?: string; col?: string } {
  const m = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(source);
  return { file: m?.[1] ?? source, line: m?.[2], col: m?.[3] };
}

/**
 * Construit l'URI qui ouvre `source` (chemin relatif au projet, `src/…:ligne[:col]`)
 * dans l'éditeur donné. `root` = racine absolue du projet. `null` si l'un manque.
 */
export function buildEditorUri(
  editor: EditorId,
  root: string | undefined | null,
  source: string | null,
): string | null {
  if (!root || !source) return null;
  const normalizedRoot = root.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalizedRoot) return null;
  const rel = source.replace(/^\/+/, "");
  if (!rel) return null;

  const info = EDITORS.find((e) => e.id === editor) ?? EDITORS[0]!;
  switch (info.family) {
    case "vscode":
      // Format historique de `buildVscodeUri` (inchangé, y compris en posix).
      return `${info.scheme}://file/${normalizedRoot}/${rel}`;
    case "zed":
      // `zed://file` + chemin absolu : pas de double slash en posix.
      return `zed://file/${normalizedRoot.replace(/^\/+/, "")}/${rel}`;
    case "jetbrains": {
      const { file, line, col } = parseSource(rel);
      let uri = `${info.scheme}://open?file=${encodeURIComponent(`${normalizedRoot}/${file}`)}`;
      if (line) uri += `&line=${line}`;
      if (line && col) uri += `&column=${col}`;
      return uri;
    }
  }
}
