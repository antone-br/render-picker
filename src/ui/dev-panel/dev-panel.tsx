import { useEffect, useReducer, useRef, useState } from "react";

import { UI_Z } from "../../core/inspector/constants/picker";
import {
  CARD_SHADOW,
  ELEVATED_BG,
  MUTED,
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
  SOLID_BG,
  TOOLTIP_SHADOW,
} from "../../core/inspector/constants/theme";
import { clearLogs, clearRequests, getState, subscribe } from "../../core/devpanel/store";
import { loadPanelState, savePanelState } from "../../core/devpanel/panel-state";
import { HtmlTree } from "../html-tree/html-tree";
import { ConsoleTab } from "./console-tab";
import { NetworkTab } from "./network-tab";
import { ACCENT_CORNER, GUTTER, HANDLE_BG, headerBtn, plainBtn } from "./styles";
import { useDragResize } from "./use-drag-resize";

type Tab = "console" | "network" | "html";

export interface DevPanelProps {
  onClose: () => void;
  /** Taille initiale (persistée par l'appelant : config .json côté npm). */
  size?: { width: number; height: number };
  /** Appelé à la fin d'un redimensionnement avec la nouvelle taille. */
  onSizeChange?: (size: { width: number; height: number }) => void;
}

/** Panneau d'inspection flottant déplaçable + redimensionnable : Console / Network / HTML. */
export function DevPanel({ onClose, size, onSizeChange }: DevPanelProps) {
  const init = loadPanelState();
  const [tab, setTab] = useState<Tab>(init.tab);
  const { pos, width, height, beginResize, onHeaderPointerDown } = useDragResize(
    { x: init.x, y: init.y },
    { width: size?.width ?? 420, height: size?.height ?? 320 },
    onSizeChange,
  );
  const [, force] = useReducer((n: number) => n + 1, 0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const { logs, requests } = getState();

  const copyAll = () => {
    const text =
      tab === "console"
        ? logs.map((l) => l.text).join("\n")
        : requests
            .map((r) => `${r.status || "ERR"} ${r.method} ${r.url} ${r.durationMs}ms`)
            .join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  useEffect(() => subscribe(force), []);

  // Auto-scroll en bas sur nouvelle entrée, seulement si déjà en bas (ou onglet changé).
  useEffect(() => {
    const el = bodyRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [logs.length, requests.length, tab]);

  // Position/onglet en localStorage (la taille est persistée par l'appelant via onSizeChange).
  useEffect(() => {
    savePanelState({ tab, x: pos.x, y: pos.y });
  }, [tab, pos.x, pos.y]);

  // Onglet actif : même UI que le tooltip (surface secondary + ombre + bordure).
  const tabBtn = (id: Tab, label: string) => {
    const on = tab === id;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        style={{
          padding: "4px 10px",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 6,
          cursor: "pointer",
          color: on ? "#fff" : MUTED,
          background: on ? SECONDARY_SURFACE : "transparent",
          border: on ? SECONDARY_BORDER : "1px solid transparent",
          boxShadow: on ? TOOLTIP_SHADOW : "none",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      data-pathpicker-ignore=""
      style={{
        position: "fixed",
        top: pos.y,
        left: pos.x,
        zIndex: UI_Z,
        width,
        height,
        maxWidth: "95vw",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        background: SOLID_BG,
        border: SECONDARY_BORDER,
        borderRadius: 10,
        boxShadow: CARD_SHADOW,
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* En-tête déplaçable */}
      <div
        onPointerDown={onHeaderPointerDown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 8px",
          background: ELEVATED_BG,
          cursor: "move",
          borderBottom: SECONDARY_BORDER,
        }}
      >
        {tabBtn("console", `Console${logs.length ? ` (${logs.length})` : ""}`)}
        {tabBtn("network", `Network${requests.length ? ` (${requests.length})` : ""}`)}
        {tabBtn("html", "HTML")}
        <span style={{ marginLeft: "auto" }} />
        <button type="button" aria-label="Copier" onClick={copyAll} style={plainBtn}>
          Copier
        </button>
        <button
          type="button"
          aria-label="Vider"
          onClick={tab === "console" ? clearLogs : clearRequests}
          style={plainBtn}
        >
          Vider
        </button>
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          style={{ ...headerBtn, width: 22, padding: 0, fontSize: 14 }}
        >
          ×
        </button>
      </div>

      {/* Corps */}
      <div
        ref={bodyRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
        }}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "8px 10px",
          marginRight: GUTTER,
          marginBottom: GUTTER,
          fontSize: 11,
        }}
      >
        {tab === "console" && <ConsoleTab logs={logs} />}
        {tab === "network" && <NetworkTab requests={requests} />}
        {tab === "html" && <HtmlTree />}
      </div>

      {/* Poignées de redimensionnement dans une gouttière (GUTTER) : hors des scrollbars
          du corps (inset par margin). Bande discrète visible au repos, accent au survol. */}
      <div
        onPointerDown={beginResize("x", "ew-resize")}
        onMouseEnter={(e) => (e.currentTarget.style.background = ACCENT_CORNER)}
        onMouseLeave={(e) => (e.currentTarget.style.background = HANDLE_BG)}
        style={{
          position: "absolute",
          top: 38,
          right: 0,
          bottom: 0,
          width: GUTTER,
          cursor: "ew-resize",
          background: HANDLE_BG,
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxSizing: "border-box",
        }}
      />
      <div
        onPointerDown={beginResize("y", "ns-resize")}
        onMouseEnter={(e) => (e.currentTarget.style.background = ACCENT_CORNER)}
        onMouseLeave={(e) => (e.currentTarget.style.background = HANDLE_BG)}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: GUTTER,
          cursor: "ns-resize",
          background: HANDLE_BG,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          boxSizing: "border-box",
        }}
      />
      <div
        onPointerDown={beginResize("xy", "nwse-resize")}
        onMouseEnter={(e) => (e.currentTarget.style.background = ACCENT_CORNER)}
        onMouseLeave={(e) => (e.currentTarget.style.background = HANDLE_BG)}
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: GUTTER,
          height: GUTTER,
          cursor: "nwse-resize",
          background: HANDLE_BG,
          zIndex: 1,
        }}
      />
    </div>
  );
}
