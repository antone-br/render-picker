import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { isEditorId, parseSource } from "./core/dev/editors";
import { launchEditor } from "./server/launch-editor";

// Fichier Node uniquement (next.config + route dev). Jamais bundlé côté navigateur.

type NextConfigObject = { env?: Record<string, string | undefined> } & Record<
  string,
  unknown
>;
type NextConfigFn<C> = (...args: never[]) => C | Promise<C>;

/** Lit `render-picker.config.json` à la racine, ou `undefined` s'il est absent/invalide. */
function readConfigFile(): string | undefined {
  try {
    const raw = readFileSync(join(process.cwd(), "render-picker.config.json"), "utf8");
    return JSON.stringify(JSON.parse(raw)); // normalise + valide le JSON
  } catch {
    return undefined;
  }
}

function inject<C extends NextConfigObject>(config: C): C {
  // Dev only — jamais en prod (pas de fuite de chemin local / config dans le bundle).
  if (process.env.NODE_ENV === "production") return config;
  const configFile = readConfigFile();
  return {
    ...config,
    env: {
      ...config.env,
      NEXT_PUBLIC_PROJECT_ROOT: process.cwd(),
      ...(configFile
        ? { NEXT_PUBLIC_RENDER_PICKER_CONFIG: configFile }
        : {}),
    },
  };
}

/**
 * Wrap `next.config` : expose `NEXT_PUBLIC_PROJECT_ROOT` au client hors production.
 * Accepte un objet ou une fonction `(phase, ctx) => config`.
 */
export function withRenderPicker<C extends NextConfigObject>(config: C): C;
export function withRenderPicker<C extends NextConfigObject, F extends NextConfigFn<C>>(
  config: F,
): F;
export function withRenderPicker(
  config: NextConfigObject | NextConfigFn<NextConfigObject>,
): unknown {
  if (typeof config === "function") {
    return async (...args: never[]) => inject(await config(...args));
  }
  return inject(config);
}

/* --- Route Handler dev : lit/écrit render-picker.config.json à la racine ---
 * Installer côté app : `app/api/render-picker/route.ts` →
 *   export { GET, POST } from "@antone-br/render-picker/next";
 */

const CONFIG_PATH = "render-picker.config.json";
const JSON_HEADERS = { "content-type": "application/json" } as const;

function configFilePath(): string {
  return join(process.cwd(), CONFIG_PATH);
}

/** Lit le fichier de config (`{}` si absent). Dev only. */
export function GET(): Response {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  try {
    const raw = readFileSync(configFilePath(), "utf8");
    JSON.parse(raw); // valide
    return new Response(raw, { headers: JSON_HEADERS });
  } catch {
    return new Response("{}", { headers: JSON_HEADERS });
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * `{ open: { editor, source } }` → ouvre `source` (`src/…:ligne[:col]`, relatif à la
 * racine) dans l'IDE, côté serveur (aucune config système requise, voir
 * `server/launch-editor`). Refuse tout chemin hors du projet ou inexistant.
 */
async function openInEditor(open: unknown): Promise<Response> {
  const { editor, source } = (open ?? {}) as { editor?: unknown; source?: unknown };
  if (!isEditorId(editor) || typeof source !== "string" || !source) {
    return json({ error: "invalid" }, 400);
  }
  const root = process.cwd();
  const { file, line, col } = parseSource(source.replace(/^\/+/, ""));
  const abs = resolve(root, file);
  const rel = relative(root, abs);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return json({ error: "forbidden" }, 403);
  if (!existsSync(abs) || !statSync(abs).isFile()) return json({ error: "not found" }, 404);

  const ok = await launchEditor(editor, abs, line, col);
  return ok ? json({ ok: true }) : json({ error: "editor not found" }, 500);
}

/**
 * Écrit le fichier de config depuis le body JSON — ou, si le body porte `open`,
 * ouvre le fichier dans l'IDE (Alt/Ctrl+clic). Dev only.
 */
export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await req.text());
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (parsed && typeof parsed === "object" && "open" in parsed) {
    return openInEditor((parsed as { open: unknown }).open);
  }
  // Delta vide (reset UI / réglages = défauts) : ne JAMAIS écraser le fichier de
  // config — il contient peut-être des réglages committés voulus.
  if (
    parsed == null ||
    typeof parsed !== "object" ||
    Object.keys(parsed as object).length === 0
  ) {
    return json({ ok: true, skipped: true });
  }
  try {
    writeFileSync(configFilePath(), `${JSON.stringify(parsed, null, 2)}\n`);
    return json({ ok: true });
  } catch {
    return json({ error: "invalid" }, 400);
  }
}
