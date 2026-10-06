import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { UI_Z } from "../core/inspector/constants/picker";
import {
  CARD_SHADOW,
  ELEVATED_BG,
  HOVER_BG,
  MUTED,
} from "../core/inspector/constants/theme";

export interface ContextMenuItem {
  /** Label FR affiché. */
  label: string;
  /** Description secondaire (10px, sous le label). */
  description?: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: () => void;
}

export interface ContextMenuState {
  el: HTMLElement;
  x: number;
  y: number;
}

export interface ContextMenuProps {
  /** Ancre : élément visé + position du clic droit (null = fermé). */
  at: ContextMenuState | null;
  onClose: () => void;
  items: ContextMenuItem[];
}

const PANEL_W = 200;

/**
 * Menu contextuel (clic droit sur un élément) — port du `DropdownButton`
 * renderflow (panel elevated, rows ghost, hors-viewport corrigé) en
 * inline-styles, sans dépendances. Positionné au curseur, clamp viewport.
 * Clic hors / Échap = fermer (le reste de l'app continue de vivre).
 */
export function ContextMenu({ at, onClose, items }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!at) return;
    ref.current?.animate?.(
      [
        { opacity: 0, transform: "scale(.95)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 100, easing: "ease-out" },
    );
  }, [at]);

  // Clic hors (composedPath → shadow DOM inclus) et Échap → fermer.
  useEffect(() => {
    if (!at) return;
    const onDown = (e: Event) => {
      const path = e.composedPath?.() ?? [];
      const inside = path.some(
        (n) => n instanceof Element && n.hasAttribute?.("data-rp-contextmenu"),
      );
      if (!inside) onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [at]);

  if (!at) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(8, Math.min(at.x, vw - PANEL_W - 8));
  const top = Math.max(8, Math.min(at.y, vh - 120));

  return (
    <div
      ref={ref}
      data-pathpicker-ignore=""
      data-rp-contextmenu=""
      style={{
        position: "fixed",
        left,
        top,
        zIndex: UI_Z + 10,
        width: PANEL_W,
        background: ELEVATED_BG,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        boxShadow: CARD_SHADOW,
        padding: 4,
        display: "flex",
        flexDirection: "column",
        transformOrigin: "top left",
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            item.onClick();
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = HOVER_BG;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            width: "100%",
            padding: "5px 8px",
            borderRadius: 6,
            cursor: "pointer",
            color: item.danger ? "#f87171" : "#fff",
            background: "transparent",
            border: "none",
            textAlign: "left",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {item.icon && <span style={{ flexShrink: 0, display: "block" }}>{item.icon}</span>}
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap" }}>
              {item.label}
            </span>
            {item.description && (
              <span style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>{item.description}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
