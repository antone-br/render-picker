import { useEffect, useRef } from "react";

/**
 * Ferme un popover au clic hors de tout élément portant l'attribut `attr`.
 * `composedPath()` traverse le shadow DOM (content script) et le light DOM.
 * Partagé par `search/popover` et `settings-menu`. Retire le listener au cleanup.
 */
export function useOutsideClose(attr: string, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onDown = (e: Event) => {
      const path = e.composedPath?.() ?? [];
      const inside = path.some(
        (n) => n instanceof Element && n.hasAttribute?.(attr),
      );
      if (!inside) onCloseRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [attr]);
}
