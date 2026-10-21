import { useState, type FC, type ReactNode } from "react";

import {
  MUTED,
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
  TOOLTIP_SHADOW,
} from "../../core/inspector/constants/theme";
import type { NetEntry } from "../../core/devpanel/store";
import { CopyIcon } from "../icons";

import { THIN_SCROLLBAR } from "./styles";

/** Couleur du statut d'une requête (vert ok / jaune non-2xx / rouge erreur). */
export const statusColor = (r: NetEntry): string =>
  r.status === 0 ? "#f87171" : r.ok ? "#4ade80" : "#fde68a";

/** Couleur d'une durée (vert < 100ms, jaune < 500ms, rouge au-delà). */
const durationColor = (ms: number): string =>
  ms < 100 ? "#4ade80" : ms < 500 ? "#fde68a" : "#f87171";

/** Palette syntaxique JSON (façon DevTools sombre). */
const JSON_COLORS = {
  key: "#9cdcfe",
  str: "#ce9178",
  num: "#b5cea8",
  bool: "#569cd6",
  punct: "#d4d4d8",
} as const;

/** Tokenise une ligne JSON pretty → spans colorés (clé/valeur/type). */
function JsonLine({ line }: { line: string }) {
  const re =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(<span key={last} style={{ color: JSON_COLORS.punct }}>{line.slice(last, m.index)}</span>);
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        // clé + « : »
        out.push(<span key={m.index} style={{ color: JSON_COLORS.key }}>{m[1]}</span>);
        out.push(<span key={`${m.index}c`} style={{ color: JSON_COLORS.punct }}>{m[2]}</span>);
      } else {
        out.push(<span key={m.index} style={{ color: JSON_COLORS.str }}>{m[1]}</span>);
      }
    } else if (m[3] !== undefined) {
      out.push(<span key={m.index} style={{ color: JSON_COLORS.bool }}>{m[3]}</span>);
    } else if (m[4] !== undefined) {
      out.push(<span key={m.index} style={{ color: JSON_COLORS.num }}>{m[4]}</span>);
    }
    last = re.lastIndex;
  }
  if (last < line.length) {
    out.push(<span key={last} style={{ color: JSON_COLORS.punct }}>{line.slice(last)}</span>);
  }
  return <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{out}</div>;
}

/** Texte JSON pretty → lignes colorées ; non-JSON → texte brut. */
function HighlightJson({ text }: { text: string }) {
  const pretty = prettyMaybeJson(text);
  return (
    <>
      {pretty.split("\n").map((ln, i) => (
        <JsonLine key={i} line={ln} />
      ))}
    </>
  );
}

/** Stack d'initiateur coloré : `at fn (url:line:col)` → url bleue, ligne/col verte. */
function InitiatorStack({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((ln, i) => {
        const m = /^(at\s+)?(.*?)(\s*\()?(https?:\/\/[^\s)']+)(?::(\d+):(\d+))?\)?\s*$/.exec(ln.trim());
        if (!m) {
          return <div key={i} style={{ color: "#d4d4d8" }}>{ln}</div>;
        }
        const [, atKw, fn, paren, url, line, col] = m;
        return (
          <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {atKw && <span style={{ color: MUTED }}>{atKw}</span>}
            {fn && <span style={{ color: "#d4d4d8" }}>{fn}</span>}
            {paren && <span style={{ color: MUTED }}>{paren}</span>}
            <span style={{ color: "#60a5fa" }}>{url}</span>
            {line !== undefined && (
              <span style={{ color: "#b5cea8" }}>
                {`:${line}:${col ?? "1"}`}
              </span>
            )}
            {ln.trim().endsWith(")") && <span style={{ color: MUTED }}>)</span>}
          </div>
        );
      })}
    </>
  );
}

/** URL cliquable (nouvel onglet) — bleu, soulignée au survol. */
function ClickableUrl({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        color: "#60a5fa",
        textDecoration: "none",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.textDecoration = "underline";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.textDecoration = "none";
      }}
    >
      {url}
    </a>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{title}</div>
        {action}
      </div>
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{children}</div>
    </div>
  );
}

/** Petit bouton icône « tout copier » (aligné à droite du titre de section). */
function CopyAllBtn({ onCopy }: { onCopy: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Tout copier"
      title="Tout copier"
      onClick={() => {
        onCopy();
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: 4,
        cursor: "pointer",
        color: done ? "#4ade80" : MUTED,
        background: "transparent",
        border: "none",
        padding: 0,
      }}
    >
      <CopyIcon />
    </button>
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
export const NetDetail: FC<{ r: NetEntry }> = ({ r }) => {
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
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              <span style={{ color: "#c586c0", fontWeight: 600 }}>{r.method}</span>{" "}
              <ClickableUrl url={r.url} />
              {"\n"}
              <span style={{ color: MUTED }}>Statut : </span>
              <span style={{ color: statusColor(r) }}>{r.status || "ERR"}</span>
              {r.type && (
                <>
                  {"\n"}
                  <span style={{ color: MUTED }}>Type : </span>
                  <span style={{ color: "#ce9178" }}>{r.type}</span>
                </>
              )}
              {"\n"}
              <span style={{ color: MUTED }}>Durée : </span>
              <span style={{ color: durationColor(r.durationMs) }}>
                {r.durationMs}ms
              </span>
            </div>
          </Section>
          {reqH && <Section title="Request headers">{reqH}</Section>}
          {resH && <Section title="Response headers">{resH}</Section>}
        </>
      )}
      {active === "payload" && r.reqBody && (
        <Section
          title="Payload"
          action={
            <CopyAllBtn
              onCopy={() => navigator.clipboard?.writeText(prettyMaybeJson(r.reqBody!)).catch(() => {})}
            />
          }
        >
          <HighlightJson text={r.reqBody} />
        </Section>
      )}
      {active === "response" && r.resBody && (
        <Section
          title="Response"
          action={
            <CopyAllBtn
              onCopy={() => navigator.clipboard?.writeText(prettyMaybeJson(r.resBody!)).catch(() => {})}
            />
          }
        >
          <div style={{ maxHeight: 160, overflow: "auto", ...THIN_SCROLLBAR }}>
            <HighlightJson text={r.resBody} />
          </div>
        </Section>
      )}
      {active === "initiator" && r.initiator && (
        <Section title="Initiator">
          <InitiatorStack text={r.initiator} />
        </Section>
      )}
    </div>
  );
};
