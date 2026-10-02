import { useEffect, useRef } from "react";

import { CARD_SHADOW, ELEVATED_BG, HOVER_BG } from "../core/inspector/pick-style";
import { Pickbox } from "./pickbox";

export interface SettingsMenuProps {
  showPadding: boolean;
  showGap: boolean;
  showMargin: boolean;
  onTogglePadding: () => void;
  onToggleGap: () => void;
  onToggleMargin: () => void;
  /** Fermeture au clic hors de `[data-rp-settings]`. */
  onClose: () => void;
}

/**
 * Dropdown paramètres (vers le haut) : toggles de visualisation layout
 * (padding / gap / margin), UI reprise de `DropdownButton` renderflow.
 */
export function SettingsMenu({
  showPadding,
  showGap,
  showMargin,
  onTogglePadding,
  onToggleGap,
  onToggleMargin,
  onClose,
}: SettingsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Animation d'entrée jouée une seule fois à l'ouverture.
    ref.current?.animate?.(
      [
        { opacity: 0, transform: "scale(.95) translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 120, easing: "ease-out" },
    );
    const onDown = (e: Event) => {
      const t = e.target as Element | null;
      if (!t?.closest?.("[data-rp-settings]")) onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onClose]);

  const items = [
    { label: "Afficher le padding", on: showPadding, toggle: onTogglePadding },
    { label: "Afficher le gap", on: showGap, toggle: onToggleGap },
    { label: "Afficher le margin", on: showMargin, toggle: onToggleMargin },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        pointerEvents: "auto",
        background: ELEVATED_BG,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        boxShadow: CARD_SHADOW,
        padding: 4,
        display: "flex",
        flexDirection: "column",
        minWidth: 190,
        transformOrigin: "bottom center",
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitemcheckbox"
          aria-checked={item.on}
          onClick={item.toggle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = HOVER_BG;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "4px 8px",
            fontSize: 11,
            borderRadius: 6,
            color: "#fff",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
            transition: "background 120ms",
          }}
        >
          <Pickbox checked={item.on} />
          <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
