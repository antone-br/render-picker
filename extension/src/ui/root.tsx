import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { UI_Z } from "../../../src/core/inspector/constants/picker";
import {
  PANEL_BORDER,
  SOLID_BG,
  TOOLTIP_SHADOW,
} from "../../../src/core/inspector/constants/theme";
import { formatHtml, formatResult, formatResults } from "../../../src/core/format";
import { tooltipClasses } from "../../../src/core/inspector/surfaces/tooltip";
import { enrichResult } from "../../../src/core/source/enrich";
import type { RenderPickerSettings } from "../../../src/core/settings";
import { loadPanelState, savePanelState } from "../../../src/core/devpanel/panel-state";
import { DevPanel } from "../../../src/ui/dev-panel";
import { formatResult } from "../../../src/core/format";
import { pickResultFromElement } from "../../../src/core/search/element-search";
import { CrosshairIcon } from "../../../src/ui/icons";
import { SettingsBar } from "../../../src/ui/settings-bar";
import { SearchPopover } from "../../../src/ui/search-popover";
import { useRenderPicker } from "../../../src/ui/use-render-picker";
import { getCommandsSync, onCommandsChange, saveCommands } from "../storage";

type Commands = RenderPickerSettings["commands"];

function copy(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {});
}

/**
 * Racine React de l'extension (montée dans un shadow root par le content script).
 * Reprend `useRenderPicker` + `SettingsBar` du package ; les commandes viennent de
 * `chrome.storage` (via storage.ts). Expose `toggle` à l'appelant pour le bouton
 * de la barre d'outils.
 */
export function ExtensionRoot({
  onReady,
}: {
  onReady: (toggle: () => void) => void;
}) {
  const [commands, setCommands] = useState<Commands>(() => getCommandsSync());
  const [hasSelection, setHasSelection] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => loadPanelState().open);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => onCommandsChange(setCommands), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  const changeCommands = useCallback((next: Commands) => {
    setCommands(next);
    saveCommands(next);
  }, []);

  const hotkey = commands.arm === "off" ? false : commands.arm;

  const { isActive, toggle } = useRenderPicker({
    hotkey,
    commands,
    getTitle: tooltipClasses,
    overlays: { padding: true, gap: true, margin: true },
    onPick: (r) => {
      copy(formatResult(enrichResult(r)));
      showToast("Copié ✓");
    },
    onPickMany: (rs) => {
      copy(formatResults(rs.map((r) => enrichResult(r))));
      showToast(`Copié ✓ · ${rs.length}`);
    },
    onCopyHtml: (html) => {
      copy(formatHtml(html));
      showToast("HTML copié ✓");
    },
    onInspect: () => {
      setPanelOpen(true);
      savePanelState({ open: true });
    },
    onSearch: () => setSearchOpen((o) => !o),
    onSelectionChange: (n) => setHasSelection(n > 0),
  });

  useEffect(() => onReady(toggle), [toggle, onReady]);

  useEffect(() => {
    if (!isActive) {
      setHasSelection(false);
      setSettingsOpen(false);
    }
  }, [isActive]);

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
    background: isActive ? "#3b82f6" : hovered ? "#3b82f6" : "rgba(24,24,27,0.82)",
    border: `1px solid ${isActive ? "#3b82f6" : "rgba(255,255,255,0.18)"}`,
    boxShadow: isActive
      ? "0 0 0 3px #3b82f640, 0 2px 8px rgba(0,0,0,0.4)"
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
        aria-label="render-picker — pick an element"
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
          onChangeCommands={changeCommands}
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen((o) => !o)}
          onOpenPanel={() => {
            setPanelOpen(true);
            savePanelState({ open: true });
          }}
          showVsCode={false}
        />
      )}

      {searchOpen && (
        <SearchPopover
          onActivate={(el) => {
            copy(
              formatResult(
                enrichResult(
                  pickResultFromElement(
                    el,
                    window.location.pathname ?? "/",
                  ),
                ),
              ),
            );
            showToast("Copié ✓");
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {panelOpen && (
        <DevPanel
          size={{ width: loadPanelState().width, height: loadPanelState().height }}
          onSizeChange={(s) => savePanelState(s)}
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
}
