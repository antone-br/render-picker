import { useEffect, useRef, useState } from "react";

import {
  CARD_SHADOW,
  ELEVATED_BG,
  HOVER_BG,
  SECONDARY_BORDER,
} from "../core/inspector/constants/theme";

// Variante « blue » reprise du Button renderflow : bg blue-500/15, texte blue-400,
// bordure blue-500/30. Signale un dropdown dont la valeur n'est pas le défaut.
const BLUE_BG = "rgba(59,130,246,0.15)";
const BLUE_BG_HOVER = "rgba(59,130,246,0.22)";
const BLUE_TEXT = "#60a5fa";
const BLUE_BORDER = "rgba(59,130,246,0.3)";
const BLUE_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.2)";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Largeur FIXE du bouton (px) — évite tout décalage quand le label change. */
  width?: number;
  /** Valeur ≠ défaut : bouton en bleu (ACCENT). */
  highlight?: boolean;
}

/**
 * Dropdown stylé minimal (bouton + popover liste), thème sombre renderflow.
 * Porte `data-rp-settings` pour ne pas fermer le menu paramètres parent au clic.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  width = 80,
  highlight = false,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const t = e.target as Element | null;
      if (!ref.current?.contains(t as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  return (
    <div
      ref={ref}
      data-rp-settings=""
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = highlight ? BLUE_BG_HOVER : HOVER_BG;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = highlight ? BLUE_BG : HOVER_BG;
        }}
        style={{
          // Variante « blue » (renderflow Button) quand la valeur n'est pas par défaut.
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          width,
          padding: "3px 8px",
          fontSize: 11,
          borderRadius: 6,
          color: highlight ? BLUE_TEXT : "#fff",
          background: highlight ? BLUE_BG : HOVER_BG,
          border: highlight ? `1px solid ${BLUE_BORDER}` : SECONDARY_BORDER,
          boxShadow: highlight ? BLUE_SHADOW : undefined,
          cursor: "pointer",
          fontFamily: "system-ui, sans-serif",
          whiteSpace: "nowrap",
          transition: "background-color 150ms ease, box-shadow 150ms ease",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {current?.label ?? value}
        </span>
        <span aria-hidden style={{ opacity: highlight ? 0.9 : 0.6, fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            zIndex: 1,
            minWidth: "100%",
            background: ELEVATED_BG,
            border: SECONDARY_BORDER,
            borderRadius: 8,
            boxShadow: CARD_SHADOW,
            padding: 4,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = HOVER_BG;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  o.value === value ? HOVER_BG : "transparent";
              }}
              style={{
                textAlign: "left",
                padding: "4px 8px",
                fontSize: 11,
                borderRadius: 6,
                color: "#fff",
                background: o.value === value ? HOVER_BG : "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
