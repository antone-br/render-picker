import { useEffect, useRef } from "react";

import {
  BTN_SHADOW,
  CARD_SHADOW,
  ELEVATED_BG,
  SECONDARY_BG_HOVER,
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
} from "../core/inspector/constants/theme";
import { CloseIcon } from "./icons";

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: "Maj Maj", desc: "Armer / désarmer le picker" },
  { keys: "Clic", desc: "Copier l'élément (route + XPath + CSS + source)" },
  { keys: "Maj + clic", desc: "Sélection multiple (puis clics simples ajoutent)" },
  { keys: "Entrée", desc: "Valider la sélection multiple" },
  { keys: "Échap", desc: "Annuler / désarmer" },
  { keys: "Ctrl + clic", desc: "Ouvrir la source dans VS Code" },
  { keys: "Alt + clic", desc: "Ouvrir le fichier d'usage" },
];

const kbdStyle = {
  display: "inline-block",
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  font: "600 11px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace",
  color: "#fff",
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
  minWidth: 92,
  textAlign: "center" as const,
};

/** Popover des raccourcis, ancré au-dessus de la barre (comme le dropdown). */
export function HelpModal({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.animate?.(
      [
        { opacity: 0, transform: "scale(.95) translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 120, easing: "ease-out" },
    );
    const onDown = (e: Event) => {
      const t = e.target as Element | null;
      if (!t?.closest?.("[data-rp-help-panel]") && !t?.closest?.("[data-rp-help]")) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-rp-help-panel=""
      role="dialog"
      aria-label="Raccourcis"
      style={{
        pointerEvents: "auto",
        background: ELEVATED_BG,
        border: SECONDARY_BORDER,
        borderRadius: 8,
        boxShadow: CARD_SHADOW,
        padding: 12,
        minWidth: 320,
        maxWidth: 420,
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        transformOrigin: "bottom center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>Raccourcis</span>
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = SECONDARY_BG_HOVER;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = SECONDARY_SURFACE;
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 6,
            border: SECONDARY_BORDER,
            background: SECONDARY_SURFACE,
            boxShadow: BTN_SHADOW,
            color: "#fff",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <CloseIcon color="#fff" />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SHORTCUTS.map((s) => (
          <div key={s.keys} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={kbdStyle}>{s.keys}</span>
            <span style={{ fontSize: 12, color: "#d4d4d8" }}>{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
