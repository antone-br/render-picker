import type { LayoutOverlays } from "./types";

/**
 * Paramètres utilisateur persistés. Priorité : `render-picker.config.json` à la
 * racine (injecté au build par `withRenderPicker` → `NEXT_PUBLIC_RENDER_PICKER_CONFIG`,
 * lecture seule) > `localStorage` > défauts. Sans React.
 */

export interface RenderPickerSettings {
  /** Visualisations layout du dropdown paramètres. */
  overlays: LayoutOverlays;
}

export const DEFAULT_SETTINGS: RenderPickerSettings = {
  overlays: { padding: false, gap: false, margin: false },
};

const STORAGE_KEY = "render-picker:settings";

/** Route API dev (handlers `GET`/`POST` de `@antone-br/render-picker/next`). */
const ENDPOINT = "/api/render-picker";

/** Paramètres fournis par le fichier racine (ou `null` si absent). */
function configSettings(): Partial<RenderPickerSettings> | null {
  // Accès littéral : Next remplace `process.env.X` à la build.
  try {
    const raw = process.env.NEXT_PUBLIC_RENDER_PICKER_CONFIG;
    if (!raw) return null;
    return JSON.parse(raw) as Partial<RenderPickerSettings>;
  } catch {
    return null;
  }
}

/** Vrai si un `render-picker.config.json` racine fait autorité. */
export function hasConfigFile(): boolean {
  return configSettings() !== null;
}

function merge(
  base: RenderPickerSettings,
  patch: Partial<RenderPickerSettings> | null,
): RenderPickerSettings {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    overlays: { ...base.overlays, ...(patch.overlays ?? {}) },
  };
}

/** Charge les paramètres : fichier racine si présent, sinon localStorage, sinon défauts. */
export function loadSettings(): RenderPickerSettings {
  const file = configSettings();
  if (file) return merge(DEFAULT_SETTINGS, file);

  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw
      ? merge(DEFAULT_SETTINGS, JSON.parse(raw) as Partial<RenderPickerSettings>)
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let warnedNoRoute = false;

function warnNoRoute(detail: string): void {
  if (warnedNoRoute) return;
  warnedNoRoute = true;
  console.warn(
    `[render-picker] render-picker.config.json non écrit (POST ${ENDPOINT} → ${detail}). ` +
      `Ajoute app/api/render-picker/route.ts : export { GET, POST } from "@antone-br/render-picker/next".`,
  );
}

/**
 * Sauvegarde : localStorage (cache instantané) + POST vers la route dev (écrit
 * `render-picker.config.json`). Prévient en console si la route est absente/échoue.
 */
export function saveSettings(settings: RenderPickerSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // quota / mode privé — ignore
  }
  if (typeof fetch !== "undefined") {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    })
      .then((res) => {
        if (!res.ok) warnNoRoute(`status ${res.status}`);
      })
      .catch((e) => warnNoRoute(String(e)));
  }
}

/**
 * Lit les settings via la route dev (`render-picker.config.json`, autoritaire).
 * `null` si la route est absente / indisponible.
 */
export async function fetchSettings(): Promise<RenderPickerSettings | null> {
  if (typeof fetch === "undefined") return null;
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<RenderPickerSettings>;
    if (!data || !data.overlays) return null;
    return merge(DEFAULT_SETTINGS, data);
  } catch {
    return null;
  }
}
