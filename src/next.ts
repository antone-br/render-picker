import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

/** Écrit le fichier de config depuis le body JSON. Dev only. */
export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  try {
    const parsed = JSON.parse(await req.text());
    writeFileSync(configFilePath(), `${JSON.stringify(parsed, null, 2)}\n`);
    return new Response('{"ok":true}', { headers: JSON_HEADERS });
  } catch {
    return new Response('{"error":"invalid"}', { status: 400, headers: JSON_HEADERS });
  }
}
