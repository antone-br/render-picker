import type { FC, ReactNode } from "react";

import {
  DEFAULT_SETTINGS,
  type GestureBinding,
  type KeyChoice,
  type RenderPickerSettings,
} from "../../core/settings";
import {
  CONFIRM_KEY_OPTIONS,
  keyFromToken,
  keyToken,
  MODIFIER_OPTIONS,
  SEARCH_KEY_OPTIONS,
  TRIGGER_OPTIONS,
} from "../commands";
import { Select } from "../select";

type Commands = RenderPickerSettings["commands"];
export type GestureKey = "copy" | "copyHtml" | "multi" | "source" | "usage";

export const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "4px 8px",
  fontSize: 11,
  color: "#fff",
  fontFamily: "system-ui, sans-serif",
} as const;

const def = DEFAULT_SETTINGS.commands;

interface Common {
  commands: Commands;
  onChange: (next: Commands) => void;
}

/** Ligne « touche simple » (valider / annuler). */
export const KeyRow: FC<
  { label: string; cmdKey: "confirm" | "cancel"; options: typeof CONFIRM_KEY_OPTIONS } & Common
> = ({ label, cmdKey, options, commands, onChange }) => (
  <div style={rowStyle}>
    <span style={{ whiteSpace: "nowrap" }}>{label}</span>
    <Select
      ariaLabel={label}
      value={commands[cmdKey]}
      options={options}
      onChange={(v: KeyChoice) => onChange({ ...commands, [cmdKey]: v })}
      width={100}
      highlight={commands[cmdKey] !== def[cmdKey]}
    />
  </div>
);

/** Ligne « modificateur + touche (avec répétition) » (rechercher / inspecteur). */
export const KeyGestureRow: FC<
  { label: string; cmdKey: "search" | "inspect"; keyOptions: typeof SEARCH_KEY_OPTIONS } & Common
> = ({ label, cmdKey, keyOptions, commands, onChange }) => {
  const b = commands[cmdKey];
  return (
    <div style={rowStyle}>
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Select
          ariaLabel={`${label} — modificateur`}
          value={b.modifier}
          options={MODIFIER_OPTIONS}
          onChange={(modifier) => onChange({ ...commands, [cmdKey]: { ...b, modifier } })}
          width={78}
          highlight={b.modifier !== def[cmdKey].modifier}
        />
        <span style={{ opacity: 0.6 }}>+</span>
        <Select
          ariaLabel={`${label} — touche`}
          value={keyToken(b)}
          options={keyOptions}
          onChange={(token) =>
            onChange({ ...commands, [cmdKey]: { ...b, ...keyFromToken(token) } } as Commands)
          }
          width={104}
          highlight={keyToken(b) !== keyToken(def[cmdKey])}
        />
      </span>
    </div>
  );
};

/** Ligne « modificateur + type de clic » (copier / multi / source / usage). */
export const GestureRow: FC<{ label: string; cmdKey: GestureKey; icon?: ReactNode } & Common> = ({
  label,
  cmdKey,
  icon,
  commands,
  onChange,
}) => {
  const b = commands[cmdKey];
  const setGesture = (patch: Partial<GestureBinding>) =>
    onChange({ ...commands, [cmdKey]: { ...b, ...patch } });
  return (
    <div style={rowStyle}>
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
      >
        {icon}
        {label}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Select
          ariaLabel={`${label} — modificateur`}
          value={b.modifier}
          options={MODIFIER_OPTIONS}
          onChange={(modifier) => setGesture({ modifier })}
          width={78}
          highlight={b.modifier !== def[cmdKey].modifier}
        />
        <span style={{ opacity: 0.6 }}>+</span>
        <Select
          ariaLabel={`${label} — action`}
          value={b.trigger}
          options={TRIGGER_OPTIONS}
          onChange={(trigger) => setGesture({ trigger })}
          width={104}
          highlight={b.trigger !== def[cmdKey].trigger}
        />
      </span>
    </div>
  );
};
