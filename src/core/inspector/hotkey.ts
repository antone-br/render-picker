/**
 * Raccourcis d'armement du picker. Deux syntaxes par spec :
 *
 * - **combo** (`"ctrl+p"`, `"alt+shift+k"`) → action `"toggle"` au keydown.
 * - **double-tap** (`"shift shift"`, `"ctrl ctrl"`) → action `"arm"` (jamais
 *   toggle) : un toggle couperait le picker pendant une série de Maj+clics.
 *
 * Plusieurs specs se séparent par `,` (`"shift shift, ctrl+p"`). Pur / testable
 * via des `KeyboardEvent` synthétiques (on lit `e.timeStamp`, pas d'horloge).
 */

import { DOUBLE_TAP_WINDOW } from "./constants/behavior";

export type HotkeyAction = "toggle" | "arm";

export interface HotkeyMatcher {
  onKeyDown(e: KeyboardEvent): HotkeyAction | null;
  onKeyUp(e: KeyboardEvent): void;
  reset(): void;
}

type Modifier = "shift" | "ctrl" | "alt" | "meta";

const MOD_INFO: Record<Modifier, { key: string; prop: keyof KeyboardEvent }> = {
  shift: { key: "Shift", prop: "shiftKey" },
  ctrl: { key: "Control", prop: "ctrlKey" },
  alt: { key: "Alt", prop: "altKey" },
  meta: { key: "Meta", prop: "metaKey" },
};

const MODIFIER_ALIASES: Record<string, Modifier> = {
  shift: "shift",
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  opt: "alt",
  meta: "meta",
  cmd: "meta",
  command: "meta",
};

function asModifier(token: string): Modifier | null {
  return MODIFIER_ALIASES[token] ?? null;
}

/** Vrai si la touche de l'event correspond au dernier token d'un combo. */
function keyMatches(e: KeyboardEvent, key: string): boolean {
  if (key.length === 1 && key >= "a" && key <= "z") {
    return e.code === `Key${key.toUpperCase()}` || e.key.toLowerCase() === key;
  }
  if (key.length === 1 && key >= "0" && key <= "9") {
    return e.code === `Digit${key}` || e.key === key;
  }
  return e.key.toLowerCase() === key;
}

/** Vrai si l'event correspond exactement au combo (`"ctrl+shift+k"`). */
export function matchesHotkey(e: KeyboardEvent, spec: string): boolean {
  const tokens = spec
    .split("+")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return false;

  const key = tokens[tokens.length - 1]!;
  const mods = new Set<Modifier>();
  for (const raw of tokens.slice(0, -1)) {
    const mod = asModifier(raw);
    if (mod) mods.add(mod);
  }

  if (e.altKey !== mods.has("alt")) return false;
  if (e.ctrlKey !== mods.has("ctrl")) return false;
  if (e.metaKey !== mods.has("meta")) return false;
  if (e.shiftKey !== mods.has("shift")) return false;

  return keyMatches(e, key);
}

type Tap = { mod: Modifier; state: "idle" | "down" | "up"; lastUpAt: number };

function otherModifierHeld(e: KeyboardEvent, mod: Modifier): boolean {
  return (Object.keys(MOD_INFO) as Modifier[]).some(
    (m) => m !== mod && e[MOD_INFO[m].prop] === true,
  );
}

function parseSpecs(spec: string | string[] | false): string[] {
  if (spec === false) return [];
  const list = Array.isArray(spec) ? spec : [spec];
  return list
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createHotkeyMatcher(
  spec: string | string[] | false,
): HotkeyMatcher {
  const combos: string[] = [];
  const taps: Tap[] = [];

  for (const s of parseSpecs(spec)) {
    if (/\s/.test(s)) {
      const parts = s.split(/\s+/);
      const mod = asModifier(parts[0]?.toLowerCase() ?? "");
      if (parts.length === 2 && parts[0] === parts[1] && mod) {
        taps.push({ mod, state: "idle", lastUpAt: 0 });
      }
      continue;
    }
    combos.push(s);
  }

  return {
    onKeyDown(e) {
      if (e.repeat) return null;

      for (const combo of combos) {
        if (matchesHotkey(e, combo)) return "toggle";
      }

      for (const tap of taps) {
        if (e.key !== MOD_INFO[tap.mod].key) continue;
        if (otherModifierHeld(e, tap.mod)) {
          tap.state = "idle";
          continue;
        }
        if (tap.state === "up" && e.timeStamp - tap.lastUpAt <= DOUBLE_TAP_WINDOW) {
          tap.state = "idle";
          return "arm";
        }
        tap.state = "down";
      }

      return null;
    },

    onKeyUp(e) {
      for (const tap of taps) {
        if (e.key === MOD_INFO[tap.mod].key && tap.state === "down") {
          tap.state = "up";
          tap.lastUpAt = e.timeStamp;
        }
      }
    },

    reset() {
      for (const tap of taps) tap.state = "idle";
    },
  };
}
