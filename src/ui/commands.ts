import type {
  ArmHotkey,
  ClickModifier,
  ClickTrigger,
  InspectKey,
  KeyChoice,
  SearchKey,
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

export const INSPECT_OPTIONS: SelectOption<InspectKey>[] = [
  { value: "i", label: "Ctrl + I" },
  { value: "d", label: "Ctrl + D" },
  { value: "k", label: "Ctrl + K" },
  { value: "off", label: "Désactivé" },
];

export const SEARCH_KEY_OPTIONS: SelectOption<SearchKey>[] = [
  { value: "f", label: "Ctrl + F" },
  { value: "p", label: "Ctrl + P" },
  { value: "k", label: "Ctrl + K" },
  { value: "off", label: "Désactivé" },
];
