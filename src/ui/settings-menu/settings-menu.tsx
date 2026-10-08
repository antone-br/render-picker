import { useEffect, useRef } from "react";

import { CARD_SHADOW, ELEVATED_BG } from "../../core/inspector/constants/theme";
import { DEFAULT_SETTINGS, type RenderPickerSettings } from "../../core/settings";
import {
  ARM_OPTIONS,
  CANCEL_KEY_OPTIONS,
  CONFIRM_KEY_OPTIONS,
  INSPECT_OPTIONS,
  SEARCH_KEY_OPTIONS,
} from "../commands";
import { CopyIcon, CrosshairIcon, Html5Icon, MultiIcon, VsCodeIcon } from "../icons";
import { Select } from "../select";
import { useOutsideClose } from "../use-outside-close";
import { GestureRow, KeyGestureRow, KeyRow, rowStyle } from "./rows";

type Commands = RenderPickerSettings["commands"];

export interface SettingsMenuProps {
  commands: Commands;
  onChangeCommands: (next: Commands) => void;
  /** Fermeture au clic hors de `[data-rp-settings]`. */
  onClose: () => void;
  /** Afficher les commandes VS Code (source/usage). Défaut : `true`. */
  showVsCode?: boolean;
}

/**
 * Dropdown paramètres (vers le haut) : liste toutes les commandes remappables
 * (armement, gestes souris, touches) + bouton Réinitialiser. Les lignes vivent
 * dans `./rows` ; la fermeture au clic-hors via `useOutsideClose`.
 */
export function SettingsMenu({
  commands,
  onChangeCommands,
  onClose,
  showVsCode = true,
}: SettingsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Animation d'entrée : une seule fois au montage (sinon rejoue à chaque render).
  useEffect(() => {
    ref.current?.animate?.(
      [
        { opacity: 0, transform: "scale(.95) translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 120, easing: "ease-out" },
    );
  }, []);

  useOutsideClose("data-rp-settings", onClose);

  const def = DEFAULT_SETTINGS.commands;

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

        <GestureRow label="Copier l'élément" cmdKey="copy" icon={<CopyIcon />} commands={commands} onChange={onChangeCommands} />
        <GestureRow label="Copier le HTML" cmdKey="copyHtml" icon={<Html5Icon />} commands={commands} onChange={onChangeCommands} />
        <GestureRow label="Sélection multiple" cmdKey="multi" icon={<MultiIcon />} commands={commands} onChange={onChangeCommands} />
        {showVsCode && (
          <GestureRow label="Ouvrir le composant (global)" cmdKey="source" icon={<VsCodeIcon />} commands={commands} onChange={onChangeCommands} />
        )}
        {showVsCode && (
          <GestureRow label="Ouvrir le composant (local)" cmdKey="usage" icon={<VsCodeIcon />} commands={commands} onChange={onChangeCommands} />
        )}

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 8px" }} />

        <KeyRow label="Valider la sélection" cmdKey="confirm" options={CONFIRM_KEY_OPTIONS} commands={commands} onChange={onChangeCommands} />
        <KeyRow label="Annuler / désarmer" cmdKey="cancel" options={CANCEL_KEY_OPTIONS} commands={commands} onChange={onChangeCommands} />
        <KeyGestureRow label="Rechercher" cmdKey="search" keyOptions={SEARCH_KEY_OPTIONS} commands={commands} onChange={onChangeCommands} />
        <KeyGestureRow label="Ouvrir l'inspecteur" cmdKey="inspect" keyOptions={INSPECT_OPTIONS} commands={commands} onChange={onChangeCommands} />
      </div>
    </div>
  );
}
