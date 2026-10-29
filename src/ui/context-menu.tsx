import { useEffect, useLayoutEffect, useRef, useState, type FC, type ReactNode } from "react";

import { CONTEXT_MENU_OPEN } from "../core/inspector/constants/behavior";
import { UI_Z } from "../core/inspector/constants/picker";
import {
  CARD_SHADOW,
  ELEVATED_BG,
  HOVER_BG,
  MUTED,
} from "../core/inspector/constants/theme";
import { ChevronIcon, InfoIcon } from "./icons";
import { Tooltip } from "./tooltip";

export interface ContextMenuSubItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

export interface ContextMenuItem {
  /** Label FR affiché. */
  label: string;
  /** Description secondaire (10px, sous le label). */
  description?: string;
  icon?: ReactNode;
  /** Contenu du tooltip affiché par l'icône info (ⓘ) en fin de ligne. */
  info?: ReactNode;
  /** Sous-menu affiché au survol (flyout à droite) — ex. choix relatif/absolu. */
  submenu?: ContextMenuSubItem[];
  danger?: boolean;
  /** Ligne inerte (grisée) : pas de clic ni de survol. */
  disabled?: boolean;
  onClick: () => void;
}

export interface ContextMenuState {
  el: HTMLElement;
  x: number;
  y: number;
  /** Nom + chemins + URL de config du module (overlay permanent PrestaShop uniquement) —
   * absent pour un clic droit normal du picker, auquel cas la ligne "Modules" n'apparaît pas. */
  modulePath?: {
    name: string;
    hookName: string | null;
    relative: string | null;
    absolute: string | null;
    configUrl: string | null;
    hookPositionsUrl: string | null;
  } | null;
  /** Markdown listant tous les modules de la page (arbre par confinement géométrique) —
   * même garde que `modulePath` (overlay modules uniquement). */
  modulesTree?: string;
}

export interface ContextMenuProps {
  /** Ancre : élément visé + position du clic droit (null = fermé). */
  at: ContextMenuState | null;
  onClose: () => void;
  items: ContextMenuItem[];
}

const PANEL_W = 200;
const SUBMENU_W = 210;
const SUBMENU_GAP = 4;
/** Délai avant fermeture du flyout après sortie de la ligne/flyout — laisse le temps de
 * traverser l'espace entre les deux sans le fermer (pas de chevauchement visuel). */
const SUBMENU_CLOSE_DELAY_MS = 200;

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
  /** Ligne dont le sous-menu (flyout) est actuellement affiché au survol. */
  const [submenuIndex, setSubmenuIndex] = useState<number | null>(null);
  const submenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Hauteur réelle du panneau — mesurée après rendu (nombre de lignes variable selon
   * `items`), pour décider d'ouvrir vers le bas ou vers le haut. Estimation par défaut
   * avant 1re mesure (pas de flash : `useLayoutEffect` corrige avant le paint). */
  const [panelHeight, setPanelHeight] = useState(240);

  useLayoutEffect(() => {
    if (!at || !ref.current) return;
    setPanelHeight(ref.current.getBoundingClientRect().height);
  }, [at, items]);

  const openSubmenu = (i: number) => {
    if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current);
    setSubmenuIndex(i);
  };
  const scheduleCloseSubmenu = (i: number) => {
    if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current);
    submenuCloseTimer.current = setTimeout(() => {
      setSubmenuIndex((cur) => (cur === i ? null : cur));
    }, SUBMENU_CLOSE_DELAY_MS);
  };

  useEffect(() => {
    setSubmenuIndex(null);
    return () => {
      if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current);
    };
  }, [at]);

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
  // Ouvre vers le bas par défaut ; si ça ne tient pas (clic trop bas), bascule vers le
  // haut plutôt que de rester plaqué/rogné en bas du viewport.
  let topBase: number;
  if (at.y + panelHeight <= vh - 8) {
    topBase = at.y;
  } else if (at.y - panelHeight >= 8) {
    topBase = at.y - panelHeight;
  } else {
    topBase = Math.max(8, vh - panelHeight - 8);
  }
  const top = topBase + dy;
  // Flyout à droite par défaut ; bascule à gauche s'il déborderait du viewport.
  const submenuOnLeft = left + PANEL_W + SUBMENU_GAP + SUBMENU_W > vw - 8;

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
        <div
          key={i}
          style={{ position: "relative" }}
          onMouseEnter={() => {
            if (item.submenu && !item.disabled) openSubmenu(i);
          }}
          onMouseLeave={() => {
            if (item.submenu) scheduleCloseSubmenu(i);
          }}
        >
          <button
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
            {item.submenu && (
              <span style={{ marginLeft: "auto", alignSelf: "center", display: "flex" }}>
                <ChevronIcon dir={submenuOnLeft ? "left" : "right"} color={MUTED} />
              </span>
            )}
          </button>

          {item.submenu && submenuIndex === i && (
            <div
              data-pathpicker-ignore=""
              data-rp-contextmenu=""
              onMouseEnter={() => openSubmenu(i)}
              onMouseLeave={() => scheduleCloseSubmenu(i)}
              style={{
                position: "absolute",
                // Compense le padding (4px) de ce panneau : aligne le 1er item du flyout
                // avec la ligne déclenchante plutôt que 4px plus bas.
                top: -4,
                ...(submenuOnLeft
                  ? { right: `calc(100% + ${SUBMENU_GAP}px)` }
                  : { left: `calc(100% + ${SUBMENU_GAP}px)` }),
                width: SUBMENU_W,
                background: ELEVATED_BG,
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                boxShadow: CARD_SHADOW,
                padding: 4,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {item.submenu.map((sub, j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => sub.onClick()}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = HOVER_BG;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: "#fff",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 11,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {sub.icon && <span style={{ flexShrink: 0, display: "block" }}>{sub.icon}</span>}
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
