import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { UI_Z } from "../core/inspector/constants/picker";
import {
  ELEVATED_BG,
  PANEL_BORDER,
  TOOLTIP_SHADOW,
} from "../core/inspector/constants/theme";

export interface ToolbarTooltipProps {
  /** Texte affiché au survol. */
  label: string;
  /** Raccourci affiché à droite du label (mono, muted). */
  shortcut?: string;
  /** Position du panneau par rapport au bouton. */
  side?: "top" | "bottom";
  children: ReactNode;
}

/**
 * Infobulle au survol (délai ~450 ms), style tooltip inspecteur. Sans portail :
 * position absolue dans le parent `relative` du bouton. Fermeture immédiate au
 * blur/leave ; le contenu n'intercepte pas les events (pointer-events none).
 */
export function ToolbarTooltip({
  label,
  shortcut,
  side = "top",
  children,
}: ToolbarTooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 450);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  const wrapStyle: CSSProperties = {
    position: "relative",
    display: "inline-flex",
  };
  const bubbleStyle: CSSProperties = {
    position: "absolute",
    [side === "top" ? "bottom" : "top"]: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: UI_Z + 5,
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontFamily: "system-ui, sans-serif",
    color: "#fff",
    background: ELEVATED_BG,
    border: PANEL_BORDER,
    boxShadow: TOOLTIP_SHADOW,
    pointerEvents: "none",
  };

  return (
    <span
      style={wrapStyle}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {open && (
        <span role="tooltip" style={bubbleStyle}>
          {label}
          {shortcut && (
            <span
              style={{
                font: "600 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "#c4c4c8",
              }}
            >
              {shortcut}
            </span>
          )}
        </span>
      )}
      {children}
    </span>
  );
}