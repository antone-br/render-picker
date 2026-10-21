import { useEffect, useRef, useState, type FC, type ReactNode } from "react";

import { CONTEXT_MENU_OPEN } from "../core/inspector/constants/behavior";
import { UI_Z } from "../core/inspector/constants/picker";
import {
  CARD_SHADOW,
  ELEVATED_BG,
  HOVER_BG,
  MUTED,
} from "../core/inspector/constants/theme";
import { InfoIcon } from "./icons";
import { Tooltip } from "./tooltip";

export interface ContextMenuItem {
  /** Label FR affiché. */
  label: string;
  /** Description secondaire (10px, sous le label). */
  description?: string;
  icon?: ReactNode;
  /** Contenu du tooltip affiché par l'icône info (ⓘ) en fin de ligne. */
  info?: ReactNode;
  danger?: boolean;
  /** Ligne inerte (grisée) : pas de clic ni de survol. */
  disabled?: boolean;
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

/** Déplacement de l'élément ancre depuis l'ouverture du menu `at`. */
interface AnchorShift {
  at: ContextMenuState;
  dx: number;
  dy: number;
}

/**
 * Menu contextuel (clic droit sur un élément) — port du `DropdownButton`
 * renderflow (panel elevated, rows ghost, hors-viewport corrigé) en
 * inline-styles, sans dépendances. Positionné au curseur, clamp viewport,
 * puis ancré à `at.el` : au scroll / resize il suit l'élément (comme le rect
 * de survol). Clic hors / Échap = fermer (le reste de l'app continue de vivre).
 */
export const ContextMenu: FC<ContextMenuProps> = ({ at, onClose, items }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [shift, setShift] = useState<AnchorShift | null>(null);
  /** Animation d'entrée jouée une seule fois (re-ancrage = déplacement sans blink). */
  const wasOpen = useRef(false);

  // Suivi de l'élément ancre : delta de son rect depuis l'ouverture, une fois
  // par frame (scroll capture → fenêtre ET sous-conteneurs).
  useEffect(() => {
    if (!at) return;
    const origin = at.el.getBoundingClientRect();
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!at.el.isConnected) return;
      const r = at.el.getBoundingClientRect();
      setShift({ at, dx: r.left - origin.left, dy: r.top - origin.top });
    };
    const onChange = () => {
      if (typeof requestAnimationFrame !== "function") return update();
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
      if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    };
  }, [at]);

  useEffect(() => {
    if (!at) {
      wasOpen.current = false;
      return;
    }
    // Flag global : le geste de fermeture (clic hors) ne pick pas.
    CONTEXT_MENU_OPEN.value = true;
    if (!wasOpen.current) {
      wasOpen.current = true;
      ref.current?.animate?.(
        [
          { opacity: 0, transform: "scale(.95)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 100, easing: "ease-out" },
      );
    }
    return () => {
      CONTEXT_MENU_OPEN.value = false;
    };
  }, [at]);

  // Clic hors (composedPath → shadow DOM inclus) et Échap → fermer.
  // Clic DROIT hors : ne ferme PAS ici — le contextmenu qui suit re-ancre le
  // menu (déplacement sans blink) ; si personne ne le preventDefault (zone
  // vide → menu natif), on ferme après coup via `defaultPrevented`.
  useEffect(() => {
    if (!at) return;
    const onDown = (e: Event) => {
      const path = e.composedPath?.() ?? [];
      const inside = path.some(
        (n) => n instanceof Element && n.hasAttribute?.("data-rp-contextmenu"),
      );
      if (inside) return;
      if ("button" in e && (e as MouseEvent).button === 2) return;
      onCloseRef.current();
    };
    const onCtx = (e: MouseEvent) => {
      const path = e.composedPath?.() ?? [];
      const inside = path.some(
        (n) => n instanceof Element && n.hasAttribute?.("data-rp-contextmenu"),
      );
      if (inside) return;
      // Laisse le dispatch se terminer (nos handlers preventDefault) avant de
      // décider : menu rouvert/re-ancré = pas de fermeture, zone vide = fermer.
      setTimeout(() => {
        if (!e.defaultPrevented) onCloseRef.current();
      }, 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("contextmenu", onCtx, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("contextmenu", onCtx, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [at]);

  if (!at) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Clamp viewport sur la position d'ouverture seulement : ensuite le menu
  // suit l'élément, même s'il sort de l'écran avec lui.
  const { dx, dy } = shift?.at === at ? shift : { dx: 0, dy: 0 };
  const left = Math.max(8, Math.min(at.x, vw - PANEL_W - 8)) + dx;
  const top = Math.max(8, Math.min(at.y, vh - 120)) + dy;

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
          disabled={item.disabled}
          onClick={() => {
            if (!item.disabled) item.onClick();
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) e.currentTarget.style.background = HOVER_BG;
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
            cursor: item.disabled ? "default" : "pointer",
            color: item.danger ? "#f87171" : "#fff",
            background: "transparent",
            border: "none",
            textAlign: "left",
            fontFamily: "system-ui, sans-serif",
            opacity: item.disabled ? 0.4 : 1,
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
          {item.info && (
            <span
              style={{ marginLeft: "auto", alignSelf: "center", display: "flex" }}
              // L'ⓘ n'est qu'informatif : ne pas déclencher le onClick de la ligne.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <Tooltip content={item.info}>
                <InfoIcon />
              </Tooltip>
            </span>
          )}
        </button>
      ))}
    </div>
  );
};
