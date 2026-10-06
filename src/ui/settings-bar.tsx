import { UI_Z } from "../core/inspector/constants/picker";
import {
  BTN_SHADOW,
  HOVER_BG,
  MUTED,
  SECONDARY_BG_HOVER,
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
} from "../core/inspector/constants/theme";
import type { RenderPickerSettings } from "../core/settings";
import { GearIcon, PanelIcon, SearchIcon } from "./icons";
import { SettingsMenu } from "./settings-menu";

type Commands = RenderPickerSettings["commands"];

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
  commands: Commands;
  onChangeCommands: (next: Commands) => void;
  /** Ouvre/ferme le panneau d'inspection (bouton à gauche). */
  onTogglePanel: () => void;
  /** Ouvre la recherche d'éléments (bouton loupe, avant l'engrenage). */
  onToggleSearch: () => void;
  /** Recherche ouverte (état du bouton — fond actif). */
  searchOpen: boolean;
  /** Afficher les commandes VS Code (source/usage). Défaut : `true`. */
  showVsCode?: boolean;
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
  commands,
  onChangeCommands,
  onTogglePanel,
  onToggleSearch,
  searchOpen,
  showVsCode = true,
}: SettingsBarProps) {
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
          commands={commands}
          onChangeCommands={onChangeCommands}
          onClose={onCloseSettings}
          showVsCode={showVsCode}
        />
      )}

      <div
        style={{
          pointerEvents: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 6px",
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
        <button
          type="button"
          data-rp-panel=""
          aria-label="Ouvrir l'inspecteur"
          onClick={onTogglePanel}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = SECONDARY_BG_HOVER;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          style={ghostButton(false)}
        >
          <PanelIcon color={MUTED} />
        </button>
        <span style={{ padding: "0 2px" }}>
          {hasSelection ? "Entrée pour valider" : "Échap pour annuler"}
        </span>
        <button
          type="button"
          data-rp-search=""
          data-rp-search-ui=""
          aria-label="Rechercher des éléments"
          aria-expanded={searchOpen}
          onClick={onToggleSearch}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = SECONDARY_BG_HOVER;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = searchOpen ? HOVER_BG : "transparent";
          }}
          style={ghostButton(searchOpen)}
        >
          <SearchIcon color={MUTED} />
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
