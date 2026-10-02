import { useState } from "react";

import { UI_Z } from "../core/inspector/constants/picker";
import {
  BTN_SHADOW,
  HOVER_BG,
  MUTED,
  SECONDARY_BG_HOVER,
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
} from "../core/inspector/constants/theme";
import { HelpModal } from "./help-modal";
import { GearIcon, HelpIcon } from "./icons";
import { SettingsMenu } from "./settings-menu";

const ghostButton = (active: boolean) =>
  ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 4,
    cursor: "pointer",
    background: active ? HOVER_BG : "transparent",
    border: "none",
    color: MUTED,
    padding: 0,
  }) as const;

export interface SettingsBarProps {
  hasSelection: boolean;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  showPadding: boolean;
  showGap: boolean;
  showMargin: boolean;
  onTogglePadding: () => void;
  onToggleGap: () => void;
  onToggleMargin: () => void;
}

/**
 * Barre du bas (style Button secondary) : statut + engrenage ouvrant le dropdown
 * paramètres vers le haut. Interactive — `data-pathpicker-ignore` pour échapper
 * au hit-test de l'inspecteur.
 */
export function SettingsBar({
  hasSelection,
  settingsOpen,
  onToggleSettings,
  onCloseSettings,
  showPadding,
  showGap,
  showMargin,
  onTogglePadding,
  onToggleGap,
  onToggleMargin,
}: SettingsBarProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div
      data-pathpicker-ignore=""
      data-rp-settings=""
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: UI_Z,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {settingsOpen && (
        <SettingsMenu
          showPadding={showPadding}
          showGap={showGap}
          showMargin={showMargin}
          onTogglePadding={onTogglePadding}
          onToggleGap={onToggleGap}
          onToggleMargin={onToggleMargin}
          onClose={onCloseSettings}
        />
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      <div
        style={{
          pointerEvents: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 6px 4px 12px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "system-ui, sans-serif",
          color: "#fff",
          background: SECONDARY_SURFACE,
          border: SECONDARY_BORDER,
          boxShadow: BTN_SHADOW,
        }}
      >
        <span>{hasSelection ? "Entrée pour valider" : "Échap pour annuler"}</span>
        <button
          type="button"
          data-rp-help=""
          aria-label="Raccourcis"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen((o) => !o)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = SECONDARY_BG_HOVER;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = helpOpen ? HOVER_BG : "transparent";
          }}
          style={ghostButton(helpOpen)}
        >
          <HelpIcon color={MUTED} />
        </button>
        <button
          type="button"
          data-rp-gear=""
          aria-label="Paramètres d'affichage"
          aria-expanded={settingsOpen}
          onClick={onToggleSettings}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = SECONDARY_BG_HOVER;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = settingsOpen ? HOVER_BG : "transparent";
          }}
          style={ghostButton(settingsOpen)}
        >
          <GearIcon color={MUTED} />
        </button>
      </div>
    </div>
  );
}
