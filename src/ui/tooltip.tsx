import { useEffect, useLayoutEffect, useRef, useState, type FC, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { UI_Z } from "../core/inspector/constants/picker";
import { BTN_SHADOW, SOLID_BG } from "../core/inspector/constants/theme";

/**
 * Tooltip React (port de `renderflow/src/components/ui/feedback/tooltip.tsx`) en
 * **inline-styles** — la lib n'a ni Tailwind ni dépendance CSS. Même UI : carte
 * sombre arrondie, dégradé `white/6`, flèche, ombre `shadow-btn-neutral`. Portail
 * vers `document.body`, `data-pathpicker-ignore` (l'inspecteur l'ignore).
 */

type TooltipSide = "top" | "right";

export interface TooltipProps {
  children: ReactNode;
  /** Contenu affiché dans la bulle. */
  content: ReactNode;
  /** Côté d'ancrage. @default "top" */
  side?: TooltipSide;
}

type HorizontalAlign = "center" | "left" | "right";

interface TooltipPosition {
  top: number;
  left: number;
  align: HorizontalAlign;
}

interface ComputeTopPositionArgs {
  triggerRect: { top: number; left: number; width: number };
  tooltipWidth: number;
  viewportWidth: number;
  padding?: number;
}

/**
 * Position horizontale près d'un bord (gauche/droite du viewport) : centrer la bulle sur
 * le déclencheur puis la clamper dans le viewport la réduirait visuellement (le texte
 * disponible rétrécit → empile trop de lignes, bulle trop haute). À la place, on ancre un
 * bord fixe de la bulle (gauche ou droite) dès que le centrage ne tient pas des deux
 * côtés — la bulle garde sa largeur naturelle complète, seule sa position bouge.
 */
function computeTopPosition({
  triggerRect,
  tooltipWidth,
  viewportWidth,
  padding = 8,
}: ComputeTopPositionArgs): { top: number; left: number; align: HorizontalAlign; arrowOffsetPx: number } {
  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  const half = tooltipWidth / 2;
  const top = triggerRect.top - 12;

  const roomLeft = triggerCenterX - padding;
  const roomRight = viewportWidth - padding - triggerCenterX;

  if (roomLeft >= half && roomRight >= half) {
    // Assez de place des deux côtés : centrage habituel (pas de bord ancré).
    const arrowOffsetPx = Math.max(4, Math.min(tooltipWidth - 4, half));
    return { top, left: triggerCenterX, align: "center", arrowOffsetPx };
  }

  if (roomLeft < half) {
    // Pas assez de place à gauche : bord gauche de la bulle ancré au padding.
    const left = padding;
    const arrowOffsetPx = Math.max(4, Math.min(tooltipWidth - 4, triggerCenterX - left));
    return { top, left, align: "left", arrowOffsetPx };
  }

  // Pas assez de place à droite : bord droit de la bulle ancré au padding.
  const left = viewportWidth - padding - tooltipWidth;
  const arrowOffsetPx = Math.max(4, Math.min(tooltipWidth - 4, triggerCenterX - left));
  return { top, left, align: "right", arrowOffsetPx };
}

/** Fond carte = dégradé `white/6` composé sur fond solide (comme `bg-card` + overlay). */
const CARD_BG = `linear-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0)), ${SOLID_BG}`;

export const Tooltip: FC<TooltipProps> = ({ children, content, side = "top" }) => {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0, align: "center" });
  const [arrowOffsetPx, setArrowOffsetPx] = useState<number | null>(null);

  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();

    if (side === "right") {
      setPosition({
        top: triggerRect.top + triggerRect.height / 2,
        left: triggerRect.right + 10,
        align: "center",
      });
      return;
    }

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const result = computeTopPosition({
      triggerRect,
      tooltipWidth: tooltipRect.width,
      viewportWidth: window.innerWidth,
    });
    setPosition({ top: result.top, left: result.left, align: result.align });
    setArrowOffsetPx(result.arrowOffsetPx);
  }, [isVisible, side]);

  const isRight = side === "right";
  const arrowLeft = arrowOffsetPx !== null ? `${arrowOffsetPx}px` : "50%";

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        style={{ display: "inline-flex", flexShrink: 0, alignSelf: "center" }}
      >
        {children}
      </span>

      {mounted &&
        createPortal(
          <div
            ref={tooltipRef}
            data-pathpicker-ignore=""
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              zIndex: UI_Z + 20,
              pointerEvents: "none",
              opacity: isVisible ? 1 : 0,
              transform: isRight
                ? `translateY(-50%) translateX(${isVisible ? "0" : "-4px"})`
                : `${position.align === "center" ? "translateX(-50%) " : ""}translateY(${isVisible ? "-100%" : "calc(-100% + 6px)"})`,
              transition: "opacity 150ms ease, transform 150ms ease",
            }}
          >
            {/* Flèche : carré tourné 45°, même fond + ombre que le corps. */}
            <div
              style={{
                position: "absolute",
                width: 8,
                height: 8,
                background: CARD_BG,
                boxShadow: BTN_SHADOW,
                ...(isRight
                  ? { top: "50%", left: -3.5, transform: "translateY(-50%) rotate(45deg)" }
                  : { bottom: -3.5, left: arrowLeft, transform: "translateX(-50%) rotate(45deg)" }),
              }}
            />
            {/* Corps de la bulle (au-dessus de la flèche). */}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                maxWidth: 240,
                padding: "6px 10px",
                borderRadius: 6,
                background: CARD_BG,
                boxShadow: BTN_SHADOW,
                color: "#fff",
                fontFamily: "system-ui, sans-serif",
                fontSize: 12,
                lineHeight: 1.4,
                whiteSpace: "normal",
              }}
            >
              {content}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
