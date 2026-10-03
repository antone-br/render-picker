import { useEffect, useRef, type ReactNode } from "react";

import { CARD_SHADOW, ELEVATED_BG } from "../core/inspector/constants/theme";
import {
  DEFAULT_SETTINGS,
  type GestureBinding,
  type KeyChoice,
  type RenderPickerSettings,
} from "../core/settings";
import {
  ARM_OPTIONS,
  CANCEL_KEY_OPTIONS,
  CONFIRM_KEY_OPTIONS,
  MODIFIER_OPTIONS,
  TRIGGER_OPTIONS,
} from "./commands";
import { CopyIcon, CrosshairIcon, Html5Icon, MultiIcon, VsCodeIcon } from "./icons";
import { Select } from "./select";

type Commands = RenderPickerSettings["commands"];

export interface SettingsMenuProps {
  commands: Commands;
  onChangeCommands: (next: Commands) => void;
  /** Fermeture au clic hors de `[data-rp-settings]`. */
  onClose: () => void;
  /** Afficher les commandes VS Code (source/usage). Défaut : `true`. */
  showVsCode?: boolean;
}

const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "4px 8px",
  fontSize: 11,
  color: "#fff",
  fontFamily: "system-ui, sans-serif",
} as const;

type GestureKey = "copy" | "copyHtml" | "multi" | "source" | "usage";

/**
 * Dropdown paramètres (vers le haut) : liste toutes les commandes remappables
 * (armement, gestes souris via deux dropdowns imbriqués, touches de validation/
 * annulation) + bouton Réinitialiser. UI reprise de `DropdownButton` renderflow.
 */
export function SettingsMenu({
  commands,
  onChangeCommands,
  onClose,
  showVsCode = true,
}: SettingsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Animation d'entrée : une seule fois au montage (sinon rejoue à chaque render
  // → le menu clignote quand on change une valeur).
  useEffect(() => {
    ref.current?.animate?.(
      [
        { opacity: 0, transform: "scale(.95) translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 120, easing: "ease-out" },
    );
  }, []);

  // Fermeture au clic hors du menu — attaché une seule fois (lit onClose via ref).
  useEffect(() => {
    const onDown = (e: Event) => {
      // composedPath() traverse le shadow DOM (e.target est retargeté sur le host
      // en content script) ; fonctionne aussi en light DOM.
      const path = e.composedPath?.() ?? [];
      const inside = path.some(
        (n) => n instanceof Element && n.hasAttribute?.("data-rp-settings"),
      );
      if (!inside) onCloseRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  const setGesture = (key: GestureKey, patch: Partial<GestureBinding>) =>
    onChangeCommands({ ...commands, [key]: { ...commands[key], ...patch } });

  const def = DEFAULT_SETTINGS.commands;

  const keyRow = (
    label: string,
    key: "confirm" | "cancel",
    options: typeof CONFIRM_KEY_OPTIONS,
  ) => (
    <div style={rowStyle}>
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
      <Select
        ariaLabel={label}
        value={commands[key]}
        options={options}
        onChange={(v: KeyChoice) => onChangeCommands({ ...commands, [key]: v })}
        width={100}
        highlight={commands[key] !== def[key]}
      />
    </div>
  );

  const gestureRow = (label: string, key: GestureKey, icon?: ReactNode) => {
    const b = commands[key];
    return (
      <div style={rowStyle}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          {icon}
          {label}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Select
            ariaLabel={`${label} — modificateur`}
            value={b.modifier}
            options={MODIFIER_OPTIONS}
            onChange={(modifier) => setGesture(key, { modifier })}
            width={78}
            highlight={b.modifier !== def[key].modifier}
          />
          <span style={{ opacity: 0.6 }}>+</span>
          <Select
            ariaLabel={`${label} — action`}
            value={b.trigger}
            options={TRIGGER_OPTIONS}
            onChange={(trigger) => setGesture(key, { trigger })}
            width={104}
            highlight={b.trigger !== def[key].trigger}
          />
        </span>
      </div>
    );
  };

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        pointerEvents: "auto",
        background: ELEVATED_BG,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        boxShadow: CARD_SHADOW,
        padding: 4,
        display: "flex",
        flexDirection: "column",
        minWidth: 260,
        transformOrigin: "bottom center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            padding: "4px 8px",
            fontSize: 14,
            fontWeight: 700,
            color: "#fff",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Commandes
        </span>

        <button
          type="button"
          onClick={() => onChangeCommands(DEFAULT_SETTINGS.commands)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e4e4e7";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
          }}
          style={{
            padding: "4px 10px",
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 6,
            color: "#09090b",
            background: "#fff",
            border: "none",
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          Réinitialiser
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", paddingTop: 2 }}>
        <div style={rowStyle}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <CrosshairIcon color="#d4d4d8" />
            Armer le picker
          </span>
            <Select
              ariaLabel="Armer le picker"
              value={commands.arm}
              options={ARM_OPTIONS}
              onChange={(arm) => onChangeCommands({ ...commands, arm })}
              width={112}
              highlight={commands.arm !== def.arm}
            />
          </div>

          {gestureRow("Copier l'élément", "copy", <CopyIcon />)}
          {gestureRow("Copier le HTML", "copyHtml", <Html5Icon />)}
          {gestureRow("Sélection multiple", "multi", <MultiIcon />)}
          {showVsCode && gestureRow("Ouvrir le composant (global)", "source", <VsCodeIcon />)}
          {showVsCode && gestureRow("Ouvrir le composant (local)", "usage", <VsCodeIcon />)}

          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.08)",
              margin: "4px 8px",
            }}
          />

          {keyRow("Valider la sélection", "confirm", CONFIRM_KEY_OPTIONS)}
          {keyRow("Annuler / désarmer", "cancel", CANCEL_KEY_OPTIONS)}
      </div>
    </div>
  );
}
