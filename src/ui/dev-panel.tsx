import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { UI_Z } from "../core/inspector/constants/picker";
import {
  CARD_SHADOW,
  ELEVATED_BG,
  MUTED,
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
  SOLID_BG,
  TOOLTIP_SHADOW,
} from "../core/inspector/constants/theme";
import {
  clearLogs,
  clearRequests,
  getState,
  subscribe,
  type LogEntry,
  type NetEntry,
} from "../core/devpanel/store";
import { loadPanelState, savePanelState } from "../core/devpanel/panel-state";

type Tab = "console" | "network";

const LEVEL_COLOR: Record<LogEntry["level"], string> = {
  log: "#d4d4d8",
  info: "#60a5fa",
  debug: "#a1a1aa",
  warn: "#fde68a",
  error: "#f87171",
};

const statusColor = (r: NetEntry): string =>
  r.status === 0 ? "#f87171" : r.ok ? "#4ade80" : "#fde68a";

export interface DevPanelProps {
  onClose: () => void;
  /** Taille initiale (persistée par l'appelant : config .json côté npm). */
  size?: { width: number; height: number };
  /** Appelé à la fin d'un redimensionnement avec la nouvelle taille. */
  onSizeChange?: (size: { width: number; height: number }) => void;
}

type ResizeAxis = "x" | "y" | "xy" | null;

/** Panneau d'inspection flottant déplaçable + redimensionnable : Console / Network. */
export function DevPanel({ onClose, size, onSizeChange }: DevPanelProps) {
  const init = loadPanelState();
  const [tab, setTab] = useState<Tab>(init.tab);
  const [pos, setPos] = useState({ x: init.x, y: init.y });
  const [width, setWidth] = useState(size?.width ?? 420);
  const [height, setHeight] = useState(size?.height ?? 320);
  const [openRows, setOpenRows] = useState<Set<number>>(() => new Set());
  const [, force] = useReducer((n: number) => n + 1, 0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<ResizeAxis>(null);
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };
  const onSizeChangeRef = useRef(onSizeChange);
  onSizeChangeRef.current = onSizeChange;
  const posRef = useRef(pos);
  posRef.current = pos;

  // Démarre un resize : fige le curseur globalement (sinon il clignote quand le
  // pointeur quitte la poignée) + bloque la sélection de texte.
  const beginResize = (axis: ResizeAxis, cursor: string) => (e: ReactPointerEvent) => {
    e.preventDefault();
    resize.current = axis;
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
    // Capture le pointeur : garantit la réception du pointerup même hors de la poignée.
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

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

  // Position/onglet en localStorage (survit au refresh). La taille est persistée
  // par l'appelant (via onSizeChange) — dans le .json côté npm.
  useEffect(() => {
    savePanelState({ tab, x: pos.x, y: pos.y });
  }, [tab, pos.x, pos.y]);

  useEffect(() => {
    const onUp = () => {
      drag.current = null;
      if (resize.current) {
        resize.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onSizeChangeRef.current?.({ ...sizeRef.current });
      }
    };
    const onMove = (e: PointerEvent) => {
      // Filet : bouton relâché mais pointerup raté → on termine (plus de resize collé).
      if ((resize.current || drag.current) && e.buttons === 0) {
        onUp();
        return;
      }
      const ax = resize.current;
      if (ax) {
        if (ax === "x" || ax === "xy") setWidth(Math.max(280, e.clientX - posRef.current.x));
        if (ax === "y" || ax === "xy") setHeight(Math.max(140, e.clientY - posRef.current.y));
        return;
      }
      if (!drag.current) return;
      setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

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
        onPointerDown={(e) => {
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
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
        style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "8px 10px", fontSize: 11 }}
      >
        {tab === "console" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, fontFamily: "ui-monospace, Menlo, monospace" }}>
            {logs.length === 0 && <span style={{ color: MUTED }}>Aucun log.</span>}
            {logs.map((l, i) => (
              <div key={i} style={{ color: LEVEL_COLOR[l.level], whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {l.text}
              </div>
            ))}
          </div>
        )}

        {tab === "network" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, fontFamily: "ui-monospace, Menlo, monospace" }}>
            {requests.length === 0 && <span style={{ color: MUTED }}>Aucune requête.</span>}
            {requests.map((r, i) => {
              const open = openRows.has(i);
              return (
                <div key={i}>
                  <div
                    onClick={() =>
                      setOpenRows((prev) => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      })
                    }
                    style={{ display: "flex", gap: 8, cursor: "pointer", wordBreak: "break-all" }}
                  >
                    <span style={{ color: MUTED, width: 10 }}>{open ? "▾" : "▸"}</span>
                    <span style={{ color: statusColor(r), minWidth: 34 }}>{r.status || "ERR"}</span>
                    <span style={{ color: MUTED, minWidth: 42 }}>{r.method}</span>
                    <span style={{ color: "#fff", flex: 1 }}>{r.url}</span>
                    <span style={{ color: MUTED }}>{r.durationMs}ms</span>
                  </div>
                  {open && <NetDetail r={r} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Poignées de redimensionnement : bord droit (largeur), bas (hauteur), coin (les deux).
          Une barre accent apparaît au survol. */}
      <div
        onPointerDown={beginResize("x", "ew-resize")}
        onMouseEnter={(e) => (e.currentTarget.style.borderRight = ACCENT_BAR)}
        onMouseLeave={(e) => (e.currentTarget.style.borderRight = "2px solid transparent")}
        style={{
          position: "absolute",
          top: 38,
          right: 0,
          bottom: 0,
          width: 22,
          cursor: "ew-resize",
          borderRight: "2px solid transparent",
          boxSizing: "border-box",
        }}
      />
      <div
        onPointerDown={beginResize("y", "ns-resize")}
        onMouseEnter={(e) => (e.currentTarget.style.borderBottom = ACCENT_BAR)}
        onMouseLeave={(e) => (e.currentTarget.style.borderBottom = "2px solid transparent")}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 22,
          cursor: "ns-resize",
          borderBottom: "2px solid transparent",
          boxSizing: "border-box",
        }}
      />
      <div
        onPointerDown={beginResize("xy", "nwse-resize")}
        onMouseEnter={(e) => (e.currentTarget.style.background = ACCENT_CORNER)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 28,
          height: 28,
          cursor: "nwse-resize",
          background: "transparent",
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ color: MUTED, fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{children}</div>
    </div>
  );
}

/** Indente le JSON si le texte en est ; sinon renvoie tel quel. */
function prettyMaybeJson(text: string): string {
  const t = text.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) return text;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return text;
  }
}

function headerList(h?: Record<string, string>) {
  if (!h || Object.keys(h).length === 0) return null;
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

type DetailTab = "headers" | "payload" | "response" | "initiator";

/** Détail déplié d'une requête réseau, en sous-onglets (type DevTools). */
function NetDetail({ r }: { r: NetEntry }) {
  const reqH = headerList(r.reqHeaders);
  const resH = headerList(r.resHeaders);

  const tabs: { id: DetailTab; label: string }[] = [{ id: "headers", label: "Headers" }];
  if (r.reqBody) tabs.push({ id: "payload", label: "Payload" });
  if (r.resBody) tabs.push({ id: "response", label: "Response" });
  if (r.initiator) tabs.push({ id: "initiator", label: "Initiator" });

  const [sub, setSub] = useState<DetailTab>("headers");
  const active = tabs.some((t) => t.id === sub) ? sub : "headers";

  return (
    <div
      style={{
        margin: "2px 0 12px 0",
        padding: 8,
        borderRadius: 6,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 10,
      }}
    >
      <div style={{ display: "flex", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
              style={{
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 5,
                cursor: "pointer",
                color: on ? "#fff" : MUTED,
                background: on ? SECONDARY_SURFACE : "transparent",
                border: on ? SECONDARY_BORDER : "1px solid transparent",
                boxShadow: on ? TOOLTIP_SHADOW : "none",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {active === "headers" && (
        <>
          <Section title="General">
            {`${r.method} ${r.url}\nStatut : ${r.status || "ERR"}${r.type ? `\nType : ${r.type}` : ""}\nDurée : ${r.durationMs}ms`}
          </Section>
          {reqH && <Section title="Request headers">{reqH}</Section>}
          {resH && <Section title="Response headers">{resH}</Section>}
        </>
      )}
      {active === "payload" && r.reqBody && (
        <Section title="Payload">{prettyMaybeJson(r.reqBody)}</Section>
      )}
      {active === "response" && r.resBody && (
        <Section title="Response">
          <div style={{ maxHeight: 160, overflow: "auto" }}>{prettyMaybeJson(r.resBody)}</div>
        </Section>
      )}
      {active === "initiator" && r.initiator && (
        <Section title="Initiator">{r.initiator}</Section>
      )}
    </div>
  );
}

const ACCENT_BAR = "2px solid #3b82f6";
const ACCENT_CORNER = "rgba(59,130,246,0.35)";

// Boutons Copier / Vider : bouton simple (comme avant).
const plainBtn = {
  padding: "3px 8px",
  fontSize: 10,
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  color: "#fff",
  background: "rgba(255,255,255,0.08)",
  fontFamily: "system-ui, sans-serif",
} as const;

// Boutons d'en-tête : même UI/hauteur que la croix (style tooltip).
const headerBtn = {
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 8px",
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 6,
  cursor: "pointer",
  color: "#fff",
  background: SECONDARY_SURFACE,
  border: SECONDARY_BORDER,
  boxShadow: TOOLTIP_SHADOW,
  fontFamily: "system-ui, sans-serif",
} as const;
