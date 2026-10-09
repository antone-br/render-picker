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

interface TooltipPosition {
  top: number;
  left: number;
}

interface ComputeTopPositionArgs {
  triggerRect: { top: number; left: number; width: number };
  tooltipWidth: number;
  viewportWidth: number;
  padding?: number;
}

/** Clamp horizontal dans le viewport + offset de flèche (repris de renderflow). */
function computeTopPosition({
  triggerRect,
  tooltipWidth,
  viewportWidth,
  padding = 8,
}: ComputeTopPositionArgs): { top: number; left: number; arrowOffsetPx: number } {
  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  let left = triggerCenterX;

  const tooltipLeft = left - tooltipWidth / 2;
  if (tooltipLeft < padding) left += padding - tooltipLeft;

  const tooltipRight = left + tooltipWidth / 2;
  if (tooltipRight > viewportWidth - padding) left -= tooltipRight - (viewportWidth - padding);

  const tooltipBodyLeft = left - tooltipWidth / 2;
  const arrowOffsetPx = Math.max(4, Math.min(tooltipWidth - 4, triggerCenterX - tooltipBodyLeft));

  return { top: triggerRect.top - 12, left, arrowOffsetPx };
}

/** Fond carte = dégradé `white/6` composé sur fond solide (comme `bg-card` + overlay). */
const CARD_BG = `linear-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0)), ${SOLID_BG}`;

export const Tooltip: FC<TooltipProps> = ({ children, content, side = "top" }) => {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
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
      });
      return;
    }

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const result = computeTopPosition({
      triggerRect,
      tooltipWidth: tooltipRect.width,
      viewportWidth: window.innerWidth,
    });
    setPosition({ top: result.top, left: result.left });
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
                : `translateX(-50%) translateY(${isVisible ? "-100%" : "calc(-100% + 6px)"})`,
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
