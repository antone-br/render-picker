import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type ResizeAxis = "x" | "y" | "xy" | null;

export interface DragResize {
  pos: { x: number; y: number };
  width: number;
  height: number;
  /** Démarre un resize sur un axe (poignée) + fige le curseur global. */
  beginResize: (axis: ResizeAxis, cursor: string) => (e: ReactPointerEvent) => void;
  /** À brancher sur l'en-tête déplaçable (`onPointerDown`). */
  onHeaderPointerDown: (e: ReactPointerEvent) => void;
}

/**
 * Déplacement (drag de l'en-tête) + redimensionnement (poignées) du panneau.
 * Gère les listeners globaux pointermove/up/cancel (avec cleanup) et notifie la
 * taille finale via `onSizeChange`. Sans dépendance au rendu du panneau.
 */
export function useDragResize(
  init: { x: number; y: number },
  initSize: { width: number; height: number },
  onSizeChange?: (size: { width: number; height: number }) => void,
): DragResize {
  const [pos, setPos] = useState(init);
  const [width, setWidth] = useState(initSize.width);
  const [height, setHeight] = useState(initSize.height);

  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<ResizeAxis>(null);
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };
  const onSizeChangeRef = useRef(onSizeChange);
  onSizeChangeRef.current = onSizeChange;
  const posRef = useRef(pos);
  posRef.current = pos;

  const beginResize = (axis: ResizeAxis, cursor: string) => (e: ReactPointerEvent) => {
    e.preventDefault();
    resize.current = axis;
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
    // Capture le pointeur : garantit la réception du pointerup même hors de la poignée.
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onHeaderPointerDown = (e: ReactPointerEvent) => {
    drag.current = { dx: e.clientX - posRef.current.x, dy: e.clientY - posRef.current.y };
  };

  useEffect(() => {
    const onUp = () => {
      drag.current = null;
      if (resize.current) {
        resize.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onSizeChangeRef.current?.({ ...sizeRef.current });
      }
    };
    const onMove = (e: PointerEvent) => {
      // Filet : bouton relâché mais pointerup raté → on termine (plus de resize collé).
      if ((resize.current || drag.current) && e.buttons === 0) {
        onUp();
        return;
      }
      const ax = resize.current;
      if (ax) {
        if (ax === "x" || ax === "xy") setWidth(Math.max(280, e.clientX - posRef.current.x));
        if (ax === "y" || ax === "xy") setHeight(Math.max(140, e.clientY - posRef.current.y));
        return;
      }
      if (!drag.current) return;
      setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return { pos, width, height, beginResize, onHeaderPointerDown };
}
