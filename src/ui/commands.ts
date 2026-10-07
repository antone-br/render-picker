import type {
  ArmHotkey,
  ClickModifier,
  ClickTrigger,
  KeyChoice,
} from "../core/settings";
import type { SelectOption } from "./select";

/** Options FR des commandes, partagées par le menu paramètres. */

export const MODIFIER_OPTIONS: SelectOption<ClickModifier>[] = [
  { value: "none", label: "Aucun" },
  { value: "ctrl", label: "Ctrl" },
  { value: "alt", label: "Alt" },
  { value: "meta", label: "Cmd" },
  { value: "shift", label: "Maj" },
];

export const TRIGGER_OPTIONS: SelectOption<ClickTrigger>[] = [
  { value: "click", label: "Clic" },
  { value: "rightclick", label: "Clic droit" },
  { value: "dblclick", label: "Double-clic" },
];

export const ARM_OPTIONS: SelectOption<ArmHotkey>[] = [
  { value: "shift shift", label: "Maj Maj" },
  { value: "ctrl ctrl", label: "Ctrl Ctrl" },
  { value: "alt alt", label: "Alt Alt" },
  { value: "off", label: "Désactivé" },
];

export const CONFIRM_KEY_OPTIONS: SelectOption<KeyChoice>[] = [
  { value: "enter", label: "Entrée" },
  { value: "space", label: "Espace" },
];

export const CANCEL_KEY_OPTIONS: SelectOption<KeyChoice>[] = [
  { value: "escape", label: "Échap" },
  { value: "space", label: "Espace" },
];

/**
 * Options du 2e dropdown (touche + répétition) : la valeur est un **token** —
 * lettre simple (`"f"`) ou doublée (`"ff"` = double-tap), ou `"off"`.
 */
export const INSPECT_OPTIONS: SelectOption<string>[] = [
  { value: "i", label: "I" },
  { value: "ii", label: "I I" },
  { value: "d", label: "D" },
  { value: "dd", label: "D D" },
  { value: "k", label: "K" },
  { value: "kk", label: "K K" },
  { value: "off", label: "Désactivé" },
];

export const SEARCH_KEY_OPTIONS: SelectOption<string>[] = [
  { value: "f", label: "F" },
  { value: "ff", label: "F F" },
  { value: "p", label: "P" },
  { value: "pp", label: "P P" },
  { value: "k", label: "K" },
  { value: "kk", label: "K K" },
  { value: "off", label: "Désactivé" },
];

/** Binding clavier → token du dropdown (`{key:"f",double:true}` → `"ff"`). Pur. */
export function keyToken(b: { key: string; double: boolean }): string {
  if (b.key === "off") return "off";
  return b.double ? b.key + b.key : b.key;
}

/** Token du dropdown → `{ key, double }` (`"ff"` → `{key:"f",double:true}`). Pur. */
export function keyFromToken(t: string): { key: string; double: boolean } {
  if (t === "off") return { key: "off", double: false };
  const double = t.length === 2 && t[0] === t[1];
  return { key: double ? t.charAt(0) : t, double };
}
