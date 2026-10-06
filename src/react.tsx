import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FC,
} from "react";

import { formatHtml, formatResult, formatResults } from "./core/format";
import { loadSettings, saveSettings } from "./core/settings";
import { enrichResult } from "./core/source/enrich";
import { startCapture } from "./core/devpanel/capture";
import { loadPanelState, savePanelState } from "./core/devpanel/panel-state";
import { NPM_MARKER_ATTR } from "./core/inspector/constants/behavior";
import { ACCENT, UI_Z } from "./core/inspector/constants/picker";
import {
  PANEL_BORDER,
  SOLID_BG,
  TOOLTIP_SHADOW,
} from "./core/inspector/constants/theme";
import type { PickResult } from "./core/types";
import { DevPanel } from "./ui/dev-panel";
import { CrosshairIcon } from "./ui/icons";
import { SettingsBar } from "./ui/settings-bar";
import { useRenderPicker } from "./ui/use-render-picker";

export type { PickResult } from "./core/types";
export { OUTPUT_PREFIX, formatResult, formatResults, formatHtml } from "./core/format";
export {
  useRenderPicker,
  type UseRenderPickerOptions,
} from "./ui/use-render-picker";

function copy(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {});
}

/** Props de `RenderPickerButton`. */
export interface RenderPickerButtonProps {
  /** Route copiée. Défaut : `window.location.pathname`. */
  pathname?: string;
  /** Raccourci d'armement. Défaut : `"shift shift"`. */
  hotkey?: string | string[] | false;
  /** Accumulation Maj+clic. Défaut : `true`. */
  multi?: boolean;
  /** Accent du bouton. Défaut : `#3b82f6`. */
  color?: string;
  /** Pick simple (clic). Défaut : copie presse-papier + toast. */
  onPick?: (result: PickResult, formatted: string) => void;
  /** Confirmation sélection multiple (Entrée). Défaut : copie + toast. */
  onPickMany?: (results: PickResult[], formatted: string) => void;
}

/**
 * Trigger render-picker : bouton custom branché sur l'inspecteur maison via
 * `useRenderPicker`. Enrichit la sortie (`fichier:ligne`), feedback de copie, et
 * barre du bas (statut + paramètres padding/gap/margin) quand armé.
 */
export const RenderPickerButton: FC<RenderPickerButtonProps> = ({
  onPick,
  onPickMany,
  pathname,
  hotkey,
  multi,
  color = ACCENT,
}) => {
  const [toast, setToast] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => loadPanelState().open);
  const [commands, setCommands] = useState(() => loadSettings().commands);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // Marqueur lu par l'extension Chrome pour se désactiver (évite le double picker).
  useEffect(() => {
    document.documentElement.setAttribute(NPM_MARKER_ATTR, "npm");
    return () => document.documentElement.removeAttribute(NPM_MARKER_ATTR);
  }, []);

  // Capture console + network pour le panneau d'inspection (si init non appelé).
  useEffect(() => startCapture(), []);

  const handlePick = useCallback(
    (result: PickResult) => {
      const enriched = enrichResult(result);
      const text = formatResult(enriched);
      if (onPick) onPick(enriched, text);
      else {
        copy(text);
        showToast("Copié ✓");
      }
    },
    [onPick, showToast],
  );

  const handlePickMany = useCallback(
    (results: PickResult[]) => {
      const enriched = results.map((r) => enrichResult(r));
      const text = formatResults(enriched);
      setHasSelection(false);
      if (onPickMany) onPickMany(enriched, text);
      else {
        copy(text);
        showToast(`Copié ✓ · ${results.length}`);
      }
    },
    [onPickMany, showToast],
  );

  // Raccourci d'armement : prop explicite prioritaire, sinon réglage `commands.arm`.
  const effectiveHotkey =
    hotkey !== undefined ? hotkey : commands.arm === "off" ? false : commands.arm;

  const handleCopyHtml = useCallback(
    (html: string) => {
      copy(formatHtml(html));
      showToast("HTML copié ✓");
    },
    [showToast],
  );

  const { isActive, toggle } = useRenderPicker({
    pathname,
    hotkey: effectiveHotkey,
    multi,
    onPick: handlePick,
    onPickMany: handlePickMany,
    onCopyHtml: handleCopyHtml,
    onInspect: () => {
      setPanelOpen(true);
      savePanelState({ open: true });
    },
    // Overlays layout toujours actifs (plus de toggle).
    overlays: { padding: true, gap: true, margin: true },
    commands,
    // L'inspecteur pilote directement l'état « sélection en cours » (fiable quel
    // que soit le mode de clic — Maj ou clic simple accumulé).
    onSelectionChange: (n) => setHasSelection(n > 0),
  });

  // Reset au désarmement.
  useEffect(() => {
    if (!isActive) {
      setHasSelection(false);
      setSettingsOpen(false);
    }
  }, [isActive]);

  // Persistance des commandes (localStorage + POST route). Ignore la valeur initiale
  // (anti-boucle) via comparaison. Lecture initiale = loadSettings (env/localStorage).
  useEffect(() => {
    const json = JSON.stringify(commands);
    if (lastSavedRef.current === null) {
      lastSavedRef.current = json; // baseline initiale — pas de sauvegarde
      return;
    }
    if (json === lastSavedRef.current) return;
    lastSavedRef.current = json;
    saveSettings({ ...loadSettings(), commands });
  }, [commands]);

  const borderColor = isActive ? color : "rgba(255,255,255,0.18)";
  const buttonStyle: CSSProperties = {
    position: "fixed",
    top: 6,
    right: 6,
    zIndex: UI_Z,
    width: 18,
    height: 18,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    cursor: "pointer",
    background: isActive ? color : hovered ? borderColor : "rgba(24,24,27,0.82)",
    border: `1px solid ${borderColor}`,
    boxShadow: isActive
      ? `0 0 0 3px ${color}40, 0 2px 8px rgba(0,0,0,0.4)`
      : "0 2px 8px rgba(0,0,0,0.35)",
    transition: "background 120ms, box-shadow 120ms, border-color 120ms",
    padding: 0,
    backdropFilter: "blur(4px)",
  };

  return (
    <>
      <button
        type="button"
        data-pathpicker-ignore=""
        onClick={toggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="renderPicker — pick an element (Alt+click opens VS Code)"
        style={buttonStyle}
      >
        <CrosshairIcon color={isActive ? "#fff" : "rgba(255,255,255,0.85)"} />
      </button>

      {isActive && (
        <SettingsBar
          hasSelection={hasSelection}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((o) => !o)}
          onCloseSettings={() => setSettingsOpen(false)}
          commands={commands}
          onChangeCommands={setCommands}
          onOpenPanel={() => {
            setPanelOpen(true);
            savePanelState({ open: true });
          }}
        />
      )}

      {panelOpen && (
        <DevPanel
          size={loadSettings().panel}
          onSizeChange={(panel) => saveSettings({ ...loadSettings(), panel })}
          onClose={() => {
            setPanelOpen(false);
            savePanelState({ open: false });
          }}
        />
      )}

      {toast && (
        <div
          data-pathpicker-ignore=""
          role="status"
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            zIndex: UI_Z,
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            color: "#fff",
            background: SOLID_BG,
            border: PANEL_BORDER,
            boxShadow: TOOLTIP_SHADOW,
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
};
