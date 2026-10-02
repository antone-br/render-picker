import { useCallback, useEffect, useRef, useState } from "react";

import { createHotkeyMatcher } from "../core/inspector/hotkey";
import { createInspector } from "../core/inspector/inspector";
import { DEFAULT_SETTINGS, type RenderPickerSettings } from "../core/settings";
import type { LayoutOverlays, PickResult } from "../core/types";

/** Options du hook `useRenderPicker`. */
export interface UseRenderPickerOptions {
  /** Route copiée. Défaut : `window.location.pathname`. */
  pathname?: string;
  /** Raccourci d'armement. Défaut : `"shift shift"` (double-tap Maj). */
  hotkey?: string | string[] | false;
  /** Accumulation Maj+clic. Défaut : `true`. */
  multi?: boolean;
  /** Pick simple (clic). */
  onPick?: (result: PickResult) => void;
  /** Confirmation d'une sélection multiple (Entrée). */
  onPickMany?: (results: PickResult[]) => void;
  /** Copier l'HTML brut (clic droit par défaut). */
  onCopyHtml?: (html: string, el: Element) => void;
  /** Visualisations layout au survol (padding/gap/margin). Lu en direct. */
  overlays?: LayoutOverlays;
  /** Liaisons des commandes (copy/multi/confirm/cancel). Lu en direct. */
  commands?: RenderPickerSettings["commands"];
  /** Notifié à chaque changement du nombre d'éléments sélectionnés. */
  onSelectionChange?: (count: number) => void;
}

/**
 * Pilote l'inspecteur maison : arme/désarme au raccourci ou via `toggle`, monte
 * l'inspecteur quand actif et le démonte sinon. No-op en SSR.
 */
export function useRenderPicker(options: UseRenderPickerOptions): {
  isActive: boolean;
  toggle: () => void;
} {
  const {
    pathname,
    hotkey = "shift shift",
    multi = true,
    onPick,
    onPickMany,
    onCopyHtml,
    overlays,
    commands,
    onSelectionChange,
  } = options;

  const [isActive, setActive] = useState(false);
  const inspectorRef = useRef<ReturnType<typeof createInspector> | null>(null);

  // Identité fraîche des callbacks/options sans recréer l'inspecteur à chaque
  // render (sinon il se désarme).
  const optsRef = useRef({
    pathname,
    multi,
    onPick,
    onPickMany,
    onCopyHtml,
    overlays,
    commands,
    onSelectionChange,
  });
  optsRef.current = {
    pathname,
    multi,
    onPick,
    onPickMany,
    onCopyHtml,
    overlays,
    commands,
    onSelectionChange,
  };

  const toggle = useCallback(() => setActive((a) => !a), []);

  // Raccourci clavier d'armement.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const matcher = createHotkeyMatcher(hotkey);
    const onKeyDown = (e: KeyboardEvent) => {
      // Échap désarme toujours (chemin React fiable, indépendant de l'inspecteur).
      if (e.key === "Escape") {
        setActive(false);
        return;
      }
      const action = matcher.onKeyDown(e);
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      if (action === "toggle") setActive((a) => !a);
      else setActive(true);
    };
    const onKeyUp = (e: KeyboardEvent) => matcher.onKeyUp(e);
    const reset = () => matcher.reset();
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("pointerdown", reset, true);
    window.addEventListener("mousedown", reset, true);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("pointerdown", reset, true);
      window.removeEventListener("mousedown", reset, true);
      window.removeEventListener("blur", reset);
    };
  }, [hotkey]);

  // Montage/démontage de l'inspecteur selon l'état armé.
  useEffect(() => {
    if (!isActive || typeof window === "undefined") return;
    const inspector = createInspector({
      // L'inspecteur se démonte lui-même après un pick ; on synchronise l'état
      // React pour désarmer le bouton (sinon il reste « armé » visuellement).
      onPick: (r) => {
        setActive(false);
        optsRef.current.onPick?.(r);
      },
      onPickMany: (rs) => {
        setActive(false);
        optsRef.current.onPickMany?.(rs);
      },
      onCopyHtml: (html, el) => {
        setActive(false);
        optsRef.current.onCopyHtml?.(html, el);
      },
      onCancel: () => setActive(false),
      getRoute: () => optsRef.current.pathname ?? window.location.pathname ?? "/",
      multi: optsRef.current.multi,
      getOverlays: () =>
        optsRef.current.overlays ?? { padding: false, gap: false, margin: false },
      getCommands: () => optsRef.current.commands ?? DEFAULT_SETTINGS.commands,
      onSelectionChange: (n) => optsRef.current.onSelectionChange?.(n),
    });
    inspector.activate();
    inspectorRef.current = inspector;
    return () => {
      inspector.deactivate();
      inspectorRef.current = null;
    };
  }, [isActive]);

  // Toggle d'un overlay → re-render immédiat des décorations (sans mousemove).
  useEffect(() => {
    inspectorRef.current?.refreshDecorations();
  }, [overlays?.padding, overlays?.gap, overlays?.margin]);

  return { isActive, toggle };
}
