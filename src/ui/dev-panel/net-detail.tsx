import { useState, type ReactNode } from "react";

import {
  MUTED,
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
  TOOLTIP_SHADOW,
} from "../../core/inspector/constants/theme";
import type { NetEntry } from "../../core/devpanel/store";

/** Couleur du statut d'une requête (vert ok / jaune non-2xx / rouge erreur). */
export const statusColor = (r: NetEntry): string =>
  r.status === 0 ? "#f87171" : r.ok ? "#4ade80" : "#fde68a";

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
export function NetDetail({ r }: { r: NetEntry }) {
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
      {active === "initiator" && r.initiator && <Section title="Initiator">{r.initiator}</Section>}
    </div>
  );
}
