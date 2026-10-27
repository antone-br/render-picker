import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
} from "react";

import { elementText, formatHtml, formatResult, formatResults } from "./core/format";
import {
  initSettingsRefresh,
  loadSettings,
  refreshSettings,
  saveSettings,
} from "./core/settings";
import { enrichResult } from "./core/source/enrich";
import { pickResultFromElement } from "./core/search/element-search";
import { startCapture } from "./core/devpanel/capture";
import { loadPanelState, savePanelState } from "./core/devpanel/panel-state";
import { setInspected } from "./core/devpanel/inspected";
import { NPM_MARKER_ATTR } from "./core/inspector/constants/behavior";
import { getXPath } from "./core/inspector/xpath";
import { serializeWithComputedStyles } from "./core/computed-html";
import { ACCENT, UI_Z } from "./core/inspector/constants/picker";
import {
  initModuleOverlaySurface,
  setModuleOverlayContextMenuHandler,
} from "./core/inspector/surfaces/module-overlays";
import {
  PANEL_BORDER,
  SOLID_BG,
  TOOLTIP_SHADOW,
} from "./core/inspector/constants/theme";
import type { PickResult } from "./core/types";
import { DevPanel } from "./ui/dev-panel/dev-panel";
import { SearchPopover } from "./ui/search/popover";
import { ContextMenu, type ContextMenuState } from "./ui/context-menu";
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
  /**
   * Route dev `/api/render-picker` disponible (app Next avec `app/api/render-picker/route.ts`).
   * `false` sans serveur Node (build standalone / PrestaShop) — évite le bruit 404 en
   * console (poll GET + `saveSettings` tentent sinon la route à chaque sync). Défaut : `true`.
   */
  useRoute?: boolean;
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
  useRoute = true,
}) => {
  const [toast, setToast] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => loadPanelState().open);
  const [searchOpen, setSearchOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [commands, setCommands] = useState(() => loadSettings().commands);
  const [showModuleOverlay, setShowModuleOverlay] = useState(
    () => loadSettings().showModuleOverlay,
  );
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

  // Ctrl+clic-droit (n'importe où sur la page) : bascule direct le toggle "rectangles
  // modules" sans passer par l'armement du picker + menu réglages.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setShowModuleOverlay((v) => !v);
    };
    window.addEventListener("contextmenu", onContextMenu, true);
    return () => window.removeEventListener("contextmenu", onContextMenu, true);
  }, []);

  // Config.json relu sur le disque au focus + re-sync de l'état des commandes
  // (édit manuel du fichier pris en compte sans recharger la page). Sans route
  // (standalone/PrestaShop) : rien à relire, le GET ne ferait que 404.
  useEffect(() => {
    if (!useRoute) return;
    const stop = initSettingsRefresh();
    const sync = async () => {
      await refreshSettings();
      const settings = loadSettings();
      setCommands(settings.commands);
      setShowModuleOverlay(settings.showModuleOverlay);
    };
    const onFocus = () => void sync();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void sync();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [useRoute]);

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
    (el: HTMLElement) => {
      copy(formatHtml(el.outerHTML));
      showToast("HTML copié ✓");
    },
    [showToast],
  );

  const handleCopyClasses = useCallback(
    (el: HTMLElement) => {
      const cls = (el.getAttribute("class") ?? "").trim().replace(/\s+/g, " ");
      copy(cls);
      showToast(cls ? "Classes copiées ✓" : "Aucune classe");
    },
    [showToast],
  );

  const { isActive, toggle, setSearchMode, disarm, getSelection } = useRenderPicker({
    pathname,
    hotkey: effectiveHotkey,
    multi,
    onPick: handlePick,
    onPickMany: handlePickMany,
    onContextMenu: (el, pos) => {
      if (el instanceof HTMLElement) {
        setContextMenu({ el, x: pos.x, y: pos.y });
      }
    },
    onInspect: (el) => {
      setInspected(el); // verrouille la cible du reveal (le picker se désarme → plus de survol)
      savePanelState({ open: true, tab: "html" }); // écrit avant le montage → DevPanel démarre sur HTML
      setPanelOpen(true);
    },
    onSearch: () => setSearchOpen((o) => !o),
    // Overlays layout toujours actifs (plus de toggle).
    overlays: { padding: true, gap: true, margin: true },
    commands,
    // L'inspecteur pilote directement l'état « sélection en cours » (fiable quel
    // que soit le mode de clic — Maj ou clic simple accumulé).
    onSelectionChange: (n) => setHasSelection(n > 0),
  });

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const contextMenuItems = useMemo(
    () => [
      {
        label: "Copier en HTML",
        onClick: () => {
          if (!contextMenu) return;
          const sel = getSelection();
          const targets =
            sel.length > 0 && sel.some((s) => s.contains(contextMenu.el))
              ? sel
              : [contextMenu.el];
          const formatted = targets.map(
            (el) => formatHtml((el as HTMLElement).outerHTML),
          );
          copy(formatted.join("\n\n"));
          showToast(
            targets.length > 1 ? `HTML copié ✓ · ${targets.length}` : "HTML copié ✓",
          );
          closeContextMenu();
          disarm();
        },
      },
      {
        label: "Copier le rendu",
        info: "HTML autoportant : styles inline + classes/variables en commentaire. Se colle partout sans le CSS de la page.",
        onClick: () => {
          if (!contextMenu) return;
          copy(serializeWithComputedStyles(contextMenu.el));
          showToast("HTML reproductible copié ✓");
          closeContextMenu();
          disarm();
        },
      },
      {
        label: "Copier les classes",
        onClick: () => {
          if (!contextMenu) return;
          const sel = getSelection();
          const targets =
            sel.length > 0 && sel.some((s) => s.contains(contextMenu.el))
              ? sel
              : [contextMenu.el];
          const list = targets.map((el) => el.getAttribute("class") ?? "");
          copy(list.join("\n\n"));
          showToast(
            list.some(Boolean)
              ? targets.length > 1
                ? `Classes copiées ✓ · ${targets.length}`
                : "Classes copiées ✓"
              : "Aucune classe",
          );
          closeContextMenu();
          disarm();
        },
      },
      {
        label: "Copier le texte",
        onClick: () => {
          if (!contextMenu) return;
          const txt = elementText(contextMenu.el);
          copy(txt ?? "");
          showToast(txt ? "Texte copié ✓" : "Aucun texte");
          closeContextMenu();
          disarm();
        },
      },
      {
        label: "Copier le XPath",
        onClick: () => {
          if (!contextMenu) return;
          copy(getXPath(contextMenu.el));
          showToast("XPath copié ✓");
          closeContextMenu();
          disarm();
        },
      },
    ],
    [contextMenu, closeContextMenu, handleCopyClasses, handleCopyHtml],
  );

  // Reset au désarmement : Échap ferme aussi la recherche (popover + rects).
  useEffect(() => {
    if (!isActive) {
      setHasSelection(false);
      setSettingsOpen(false);
      setSearchOpen(false);
      setContextMenu(null);
    }
  }, [isActive]);

  // Mode recherche : fige le rect de survol de l'inspecteur (les rects de
  // recherche prennent le relais, avec leur tooltip au survol).
  useEffect(() => {
    setSearchMode(searchOpen);
    return () => setSearchMode(false);
  }, [searchOpen, setSearchMode]);  // Persistance des commandes (localStorage + POST route). Ignore la valeur initiale
  // (anti-boucle) via comparaison. Lecture initiale = loadSettings (env/localStorage).
  useEffect(() => {
    const json = JSON.stringify(commands);
    if (lastSavedRef.current === null) {
      lastSavedRef.current = json; // baseline initiale — pas de sauvegarde
      return;
    }
    if (json === lastSavedRef.current) return;
    lastSavedRef.current = json;
    saveSettings({ ...loadSettings(), commands }, useRoute);
  }, [commands, useRoute]);

  // Persistance du toggle "rectangles modules PrestaShop" — même anti-boucle.
  const lastSavedOverlayRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (lastSavedOverlayRef.current === null) {
      lastSavedOverlayRef.current = showModuleOverlay;
      return;
    }
    if (lastSavedOverlayRef.current === showModuleOverlay) return;
    lastSavedOverlayRef.current = showModuleOverlay;
    saveSettings({ ...loadSettings(), showModuleOverlay }, useRoute);
  }, [showModuleOverlay, useRoute]);

  // Overlay permanent "modules PrestaShop" : indépendant de l'armement du picker,
  // piloté uniquement par le toggle persisté. Clic droit sur un rectangle → même menu
  // contextuel (copier HTML/rendu/classes/XPath) que le picker normal.
  useEffect(() => {
    if (!showModuleOverlay) return;
    setModuleOverlayContextMenuHandler((el, pos) => {
      if (el instanceof HTMLElement) setContextMenu({ el, x: pos.x, y: pos.y });
    });
    const stop = initModuleOverlaySurface();
    return () => {
      setModuleOverlayContextMenuHandler(null);
      stop();
    };
  }, [showModuleOverlay]);

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
          showModuleOverlay={showModuleOverlay}
          onChangeShowModuleOverlay={setShowModuleOverlay}
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen((o) => !o)}
          onTogglePanel={() => {
            const next = !panelOpen;
            setPanelOpen(next);
            savePanelState({ open: next });
          }}
        />
      )}

      {searchOpen && (
        <SearchPopover
          onClose={() => setSearchOpen(false)}
          onPickElement={(el) => {
            const route = pathname ?? window.location.pathname ?? "/";
            const enriched = enrichResult(pickResultFromElement(el, route));
            copy(formatResult(enriched));
            showToast("Copié ✓");
          }}
          onContextMenuElement={(el, pos) => {
            setContextMenu({ el, x: pos.x, y: pos.y });
          }}
        />
      )}

      {panelOpen && (
        <DevPanel
          size={loadSettings().panel}
          onSizeChange={(panel) => saveSettings({ ...loadSettings(), panel }, useRoute)}
          onClose={() => {
            setPanelOpen(false);
            savePanelState({ open: false });
          }}
        />
      )}

      {contextMenu && (
        <ContextMenu at={contextMenu} onClose={closeContextMenu} items={contextMenuItems} />
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
