/**
 * Paramètres utilisateur persistés. Priorité : `render-picker.config.json` à la
 * racine (injecté au build par `withRenderPicker` → `NEXT_PUBLIC_RENDER_PICKER_CONFIG`,
 * lecture seule) > `localStorage` > défauts. Sans React.
 */

/** Modificateur d'un geste souris remappable. */
export type ClickModifier = "none" | "ctrl" | "alt" | "meta" | "shift";

/** Type de clic d'un geste souris remappable. */
export type ClickTrigger = "click" | "rightclick" | "dblclick";

/** Liaison d'un geste souris : modificateur + type de clic. */
export interface GestureBinding {
  modifier: ClickModifier;
  trigger: ClickTrigger;
}

/** Raccourci d'armement (double-tap d'une touche, ou désactivé). */
export type ArmHotkey = "shift shift" | "ctrl ctrl" | "alt alt" | "off";

/** Touche d'une commande clavier (valider / annuler). */
export type KeyChoice = "enter" | "escape" | "space";

/** Touche d'ouverture du panneau d'inspection (ou désactivé). */
export type InspectKey = "i" | "d" | "k" | "off";

export interface RenderPickerSettings {
  /** Commandes remappables (raccourcis). */
  commands: {
    /** Armement du picker. Défaut : double Maj. */
    arm: ArmHotkey;
    /** Copier l'élément. Défaut : clic simple. */
    copy: GestureBinding;
    /** Copier l'HTML brut (`outerHTML`). Défaut : clic droit. */
    copyHtml: GestureBinding;
    /** Sélection multiple (accumulation). Défaut : Maj+clic. */
    multi: GestureBinding;
    /** Valider la sélection multiple. Défaut : Entrée. */
    confirm: KeyChoice;
    /** Annuler / désarmer. Défaut : Échap. */
    cancel: KeyChoice;
    /** Ouvrir le panneau d'inspection (Composant/Console/Network). Défaut : touche « i ». */
    inspect: InspectKey;
    /** Ouvrir la source exacte dans VS Code. Défaut : Alt+clic. */
    source: GestureBinding;
    /** Ouvrir le fichier d'usage dans VS Code. Défaut : Ctrl+clic. */
    usage: GestureBinding;
  };
  /** Panneau d'inspection : taille (px) persistée via le fichier de config. */
  panel: { width: number; height: number };
}

export const DEFAULT_SETTINGS: RenderPickerSettings = {
  commands: {
    arm: "shift shift",
    copy: { modifier: "none", trigger: "click" },
    copyHtml: { modifier: "none", trigger: "rightclick" },
    multi: { modifier: "shift", trigger: "click" },
    confirm: "enter",
    cancel: "escape",
    inspect: "i",
    source: { modifier: "alt", trigger: "click" },
    usage: { modifier: "ctrl", trigger: "click" },
  },
  panel: { width: 420, height: 320 },
};

/** État des modificateurs d'un event souris/clavier (sous-ensemble de MouseEvent). */
type ModifierState = {
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

/** Vrai si le modificateur demandé correspond à l'état de l'event. Pur. */
export function modifierMatches(mod: ClickModifier, e: ModifierState): boolean {
  switch (mod) {
    case "ctrl":
      return e.ctrlKey;
    case "alt":
      return e.altKey;
    case "meta":
      return e.metaKey;
    case "shift":
      return e.shiftKey;
    case "none":
      return !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
  }
}

/** Vrai si un geste (modificateur + type de clic) correspond à l'event. Pur. */
export function gestureMatches(
  b: GestureBinding,
  e: ModifierState,
  kind: ClickTrigger,
): boolean {
  return b.trigger === kind && modifierMatches(b.modifier, e);
}

/** Touche DOM (`KeyboardEvent.key`) d'un `KeyChoice`. */
export const KEY_OF: Record<KeyChoice, string> = {
  enter: "Enter",
  escape: "Escape",
  space: " ",
};

/** Vrai si la touche pressée correspond au `KeyChoice`. Pur. */
export function keyMatches(choice: KeyChoice, key: string): boolean {
  return KEY_OF[choice] === key;
}

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
  const patchCommands: Partial<RenderPickerSettings["commands"]> =
    patch.commands ?? {};
  return {
    ...base,
    ...patch,
    commands: {
      arm: patchCommands.arm ?? base.commands.arm,
      copy: { ...base.commands.copy, ...(patchCommands.copy ?? {}) },
      copyHtml: { ...base.commands.copyHtml, ...(patchCommands.copyHtml ?? {}) },
      multi: { ...base.commands.multi, ...(patchCommands.multi ?? {}) },
      confirm: patchCommands.confirm ?? base.commands.confirm,
      cancel: patchCommands.cancel ?? base.commands.cancel,
      inspect: patchCommands.inspect ?? base.commands.inspect,
      source: { ...base.commands.source, ...(patchCommands.source ?? {}) },
      usage: { ...base.commands.usage, ...(patchCommands.usage ?? {}) },
    },
    panel: { ...base.panel, ...(patch.panel ?? {}) },
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
    if (!data || !data.commands) return null;
    return merge(DEFAULT_SETTINGS, data);
  } catch {
    return null;
  }
}
