/**
 * Paramètres utilisateur persistés. Priorité : patch lu via la route dev
 * (`render-picker.config.json` relu sur le disque — cache à chaud, rafraîchi au
 * focus) > fichier racine injecté au build (`NEXT_PUBLIC_RENDER_PICKER_CONFIG`,
 * figé au démarrage du serveur) > `localStorage` > défauts. Sans React.
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

/** Touche d'ouverture de la recherche d'éléments (ou désactivé). */
export type SearchKey = "f" | "p" | "k" | "off";

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
    /** Ouvrir la recherche d'éléments (tag/classe/sélecteur). Défaut : touche « f ». */
    search: SearchKey;
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
    search: "f",
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

/** Patch partiel de settings : sous-ensembles de `commands` et `panel`. */
export type SettingsPatch = {
  commands?: Partial<RenderPickerSettings["commands"]>;
  panel?: Partial<RenderPickerSettings["panel"]>;
};

/** Paramètres fournis par le fichier racine (ou `null` si absent). */
function configSettings(): SettingsPatch | null {
  // Accès littéral : Next remplace `process.env.X` à la build.
  try {
    const raw = process.env.NEXT_PUBLIC_RENDER_PICKER_CONFIG;
    if (!raw) return null;
    return JSON.parse(raw) as SettingsPatch;
  } catch {
    return null;
  }
}

/** Vrai si un `render-picker.config.json` racine fait autorité. */
export function hasConfigFile(): boolean {
  return configSettings() !== null;
}

function sameBinding(a: GestureBinding, b: GestureBinding): boolean {
  return a.modifier === b.modifier && a.trigger === b.trigger;
}

/** Diff minimal entre des settings et une base (défauts par défaut). Pur. */
export function settingsDelta(
  settings: RenderPickerSettings,
  base: RenderPickerSettings = DEFAULT_SETTINGS,
): SettingsPatch {
  const delta: SettingsPatch = {};
  const commands: Partial<RenderPickerSettings["commands"]> = {};
  const sc = settings.commands;
  const bc = base.commands;
  if (sc.arm !== bc.arm) commands.arm = sc.arm;
  if (!sameBinding(sc.copy, bc.copy)) commands.copy = sc.copy;
  if (!sameBinding(sc.copyHtml, bc.copyHtml)) commands.copyHtml = sc.copyHtml;
  if (!sameBinding(sc.multi, bc.multi)) commands.multi = sc.multi;
  if (sc.confirm !== bc.confirm) commands.confirm = sc.confirm;
  if (sc.cancel !== bc.cancel) commands.cancel = sc.cancel;
  if (sc.inspect !== bc.inspect) commands.inspect = sc.inspect;
  if (sc.search !== bc.search) commands.search = sc.search;
  if (!sameBinding(sc.source, bc.source)) commands.source = sc.source;
  if (!sameBinding(sc.usage, bc.usage)) commands.usage = sc.usage;
  if (Object.keys(commands).length > 0) delta.commands = commands;
  if (
    settings.panel.width !== base.panel.width ||
    settings.panel.height !== base.panel.height
  ) {
    delta.panel = { width: settings.panel.width, height: settings.panel.height };
  }
  return delta;
}

function merge(
  base: RenderPickerSettings,
  patch: SettingsPatch | null,
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
      search: patchCommands.search ?? base.commands.search,
      source: { ...base.commands.source, ...(patchCommands.source ?? {}) },
      usage: { ...base.commands.usage, ...(patchCommands.usage ?? {}) },
    },
    panel: { ...base.panel, ...(patch.panel ?? {}) },
  };
}

/** Charge les paramètres : cache route > fichier racine (env) > localStorage > défauts. */
export function loadSettings(): RenderPickerSettings {
  if (routePatch !== undefined) return merge(DEFAULT_SETTINGS, routePatch);

  const file = configSettings();
  if (file) return merge(DEFAULT_SETTINGS, file);

  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw
      ? merge(DEFAULT_SETTINGS, JSON.parse(raw) as SettingsPatch)
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
 * Sauvegarde : **delta** vs défauts → localStorage (cache instantané) + POST vers
 * la route dev (écrit `render-picker.config.json`). Delta vide → clé nettoyée et
 * POST `{}`. Au POST OK, le cache route est alimenté (write-through) : le nouveau
 * binding est effectif sans attendre le refocus. Prévient en console si la route
 * est absente/échoue.
 */
export function saveSettings(settings: RenderPickerSettings): void {
  if (typeof window === "undefined") return;
  const delta = settingsDelta(settings);
  try {
    if (Object.keys(delta).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(delta));
    }
  } catch {
    // quota / mode privé — ignore
  }
  if (typeof fetch !== "undefined") {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(delta),
    })
      .then((res) => {
        if (!res.ok) {
          warnNoRoute(`status ${res.status}`);
          return;
        }
        routePatch = delta; // write-through : le disque vient d'être écrit
      })
      .catch((e) => warnNoRoute(String(e)));
  }
}

/** Patch brut lu via la route (`undefined` = jamais lu, `null` = route absente). */
let routePatch: SettingsPatch | null | undefined;
let refreshUsers = 0;
let stopRefresh: (() => void) | null = null;

/** Patch brut de la route dev, ou `null` (absent, vide ou indisponible). */
async function fetchPatch(): Promise<SettingsPatch | null> {
  if (typeof fetch === "undefined") return null;
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) return null;
    const data = (await res.json()) as SettingsPatch | null;
    if (!data || typeof data !== "object") return null;
    // Fichier vide / absent (`{}`) = pas de config : on retombe sur env/localStorage.
    if (Object.keys(data).length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Relecture du disque via la route dev : alimente le cache route qui devient
 * prioritaire dans `loadSettings`. Sans effet si la route est absente.
 */
export async function refreshSettings(): Promise<void> {
  const patch = await fetchPatch();
  if (patch) routePatch = patch;
}

/**
 * Écoute les moments où le fichier de config peut avoir changé (focus,
 * retour d'onglet) + fetch initial. Plusieurs init (client + bouton React)
 * partagent les mêmes listeners. Retourne une fonction d'arrêt.
 */
export function initSettingsRefresh(): () => void {
  if (typeof window === "undefined") return () => {};
  if (refreshUsers === 0) {
    void refreshSettings();
    const onFocus = () => {
      void refreshSettings();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshSettings();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    stopRefresh = () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      stopRefresh = null;
    };
  }
  refreshUsers++;
  return () => {
    refreshUsers--;
    if (refreshUsers === 0 && stopRefresh) stopRefresh();
  };
}

/** Réinitialise le cache route et l'avertissement route absente (tests / hot-reload). */
export function resetSettingsRouteCache(): void {
  routePatch = undefined;
  warnedNoRoute = false;
}

/**
 * Lit les settings via la route dev (`render-picker.config.json`, autoritaire).
 * `null` si la route est absente / indisponible / sans contenu.
 */
export async function fetchSettings(): Promise<RenderPickerSettings | null> {
  const patch = await fetchPatch();
  if (!patch || !patch.commands) return null;
  return merge(DEFAULT_SETTINGS, patch);
}
