import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FC,
} from "react";

import { enrichResult } from "./core/source/enrich";
import { createHotkeyMatcher } from "./core/inspector/hotkey";
import { createInspector } from "./core/inspector/inspector";
import {
  ACCENT,
  PANEL_BORDER,
  SOLID_BG,
  TOOLTIP_SHADOW,
} from "./core/inspector/pick-style";
import type { PickResult } from "./core/types";

export type { PickResult } from "./core/types";

/** Préfixe du texte copié. */
export const OUTPUT_PREFIX = "[renderPicker]";

/**
 * Lignes `Source:` (fichier:ligne) puis `React:` (composant) — React en dernier.
 * Chacune omise si absente.
 */
function reactLines(r: PickResult): string[] {
  const out: string[] = [];
  if (r.reactSource) out.push(`Source: ${r.reactSource}`);
  if (r.reactComponent) out.push(`React: ${r.reactComponent}`);
  return out;
}

/**
 * Formate un résultat — une ligne par champ (vrais retours à la ligne),
 * sans Origin/Project, `Source:` séparé et `React:` (composant) en dernier.
 */
export function formatResult(r: PickResult): string {
  return [
    OUTPUT_PREFIX,
    `Route: ${r.route}`,
    `XPath: ${r.xpath}`,
    `CSS: ${r.cssSelector}`,
    ...reactLines(r),
  ].join("\n");
}

/** Formate plusieurs résultats — Route partagée en tête, un bloc par élément. */
export function formatResults(results: PickResult[]): string {
  if (results.length <= 1) {
    return results[0] ? formatResult(results[0]) : OUTPUT_PREFIX;
  }
  const head = [
    `${OUTPUT_PREFIX} ${results.length} elements`,
    `Route: ${results[0]!.route}`,
  ];
  const blocks = results.map((r, i) =>
    [`#${i + 1}`, `XPath: ${r.xpath}`, `CSS: ${r.cssSelector}`, ...reactLines(r)].join(
      "\n",
    ),
  );
  return [...head, "", blocks.join("\n\n")].join("\n");
}

function copy(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {});
}

const Z = 2147483000;

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
}

/**
 * Pilote l'inspecteur maison : arme/désarme au raccourci ou via `toggle`, monte
 * l'inspecteur quand actif et le démonte sinon. No-op en SSR.
 */
export function useRenderPicker(options: UseRenderPickerOptions): {
  isActive: boolean;
  toggle: () => void;
} {
  const { pathname, hotkey = "shift shift", multi = true, onPick, onPickMany } =
    options;

  const [isActive, setActive] = useState(false);

  // Identité fraîche des callbacks/options sans recréer l'inspecteur à chaque
  // render (sinon il se désarme).
  const optsRef = useRef({ pathname, multi, onPick, onPickMany });
  optsRef.current = { pathname, multi, onPick, onPickMany };

  const toggle = useCallback(() => setActive((a) => !a), []);

  // Raccourci clavier d'armement.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const matcher = createHotkeyMatcher(hotkey);
    const onKeyDown = (e: KeyboardEvent) => {
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
      onCancel: () => setActive(false),
      getRoute: () => optsRef.current.pathname ?? window.location.pathname ?? "/",
      multi: optsRef.current.multi,
    });
    inspector.activate();
    return () => inspector.deactivate();
  }, [isActive]);

  return { isActive, toggle };
}

/** Props de `RenderPickerButton`. */
export interface RenderPickerButtonProps {
  /** Route copiée. Défaut : `window.location.pathname`. */
  pathname?: string;
  /** Raccourci d'armement. Défaut : `"shift shift"`. */
  hotkey?: string | string[] | false;
  /** Accumulation Maj+clic. Défaut : `true`. */
  multi?: boolean;
  /** Accent du bouton. Défaut : `#3b82f6`. */
  color?: string;
  /** Pick simple (clic). Défaut : copie presse-papier + toast. */
  onPick?: (result: PickResult, formatted: string) => void;
  /** Confirmation sélection multiple (Entrée). Défaut : copie + toast. */
  onPickMany?: (results: PickResult[], formatted: string) => void;
}

function CrosshairIcon({ color }: { color: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="7" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
    </svg>
  );
}

/**
 * Trigger render-picker : bouton custom (style/position maîtrisés) branché sur
 * l'inspecteur maison via `useRenderPicker`. Enrichit la sortie avec le
 * `fichier:ligne` résolu (`data-source`), feedback de copie, et rappels
 * (« Ctrl+clic → VS Code », « Maj + clic : sélection multiple ») quand armé.
 */
export const RenderPickerButton: FC<RenderPickerButtonProps> = ({
  onPick,
  onPickMany,
  pathname,
  hotkey,
  multi,
  color = ACCENT,
}) => {
  const [toast, setToast] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const handlePick = useCallback(
    (result: PickResult) => {
      const enriched = enrichResult(result);
      const text = formatResult(enriched);
      if (onPick) onPick(enriched, text);
      else {
        copy(text);
        showToast("Copié ✓");
      }
    },
    [onPick, showToast],
  );

  const handlePickMany = useCallback(
    (results: PickResult[]) => {
      const enriched = results.map((r) => enrichResult(r));
      const text = formatResults(enriched);
      setHasSelection(false);
      if (onPickMany) onPickMany(enriched, text);
      else {
        copy(text);
        showToast(`Copié ✓ · ${results.length}`);
      }
    },
    [onPickMany, showToast],
  );

  const { isActive, toggle } = useRenderPicker({
    pathname,
    hotkey,
    multi,
    onPick: handlePick,
    onPickMany: handlePickMany,
  });

  // Suivi local de la sélection multiple : l'inspecteur garde le compte en
  // interne. On marque « sélection en cours » dès un Maj+clic, on remet à zéro à
  // la confirmation (Entrée → handlePickMany), sur Échap, ou au désarmement.
  useEffect(() => {
    if (!isActive || multi === false) {
      setHasSelection(false);
      return;
    }
    const onClick = (e: MouseEvent) => {
      if (e.shiftKey) setHasSelection(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHasSelection(false);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [isActive, multi]);

  const borderColor = isActive ? color : "rgba(255,255,255,0.18)";
  const buttonStyle: CSSProperties = {
    position: "fixed",
    top: 6,
    right: 6,
    zIndex: Z,
    width: 18,
    height: 18,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    cursor: "pointer",
    background: isActive
      ? color
      : hovered
        ? borderColor
        : "rgba(24,24,27,0.82)",
    border: `1px solid ${borderColor}`,
    boxShadow: isActive
      ? `0 0 0 3px ${color}40, 0 2px 8px rgba(0,0,0,0.4)`
      : "0 2px 8px rgba(0,0,0,0.35)",
    transition: "background 120ms, box-shadow 120ms, border-color 120ms",
    padding: 0,
    backdropFilter: "blur(4px)",
  };

  const hintStyle: CSSProperties = {
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontFamily: "system-ui, sans-serif",
    color: "#fff",
    background: SOLID_BG,
    border: PANEL_BORDER,
    boxShadow: TOOLTIP_SHADOW,
    whiteSpace: "nowrap",
  };

  return (
    <>
      <button
        type="button"
        data-pathpicker-ignore=""
        onClick={toggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="renderPicker — pick an element (Ctrl+click opens VS Code)"
        title="renderPicker: pick an element to copy its path — Ctrl+click opens the source in VS Code"
        style={buttonStyle}
      >
        <CrosshairIcon color={isActive ? "#fff" : "rgba(255,255,255,0.85)"} />
      </button>

      {isActive && (
        <div
          data-pathpicker-ignore=""
          style={{
            position: "fixed",
            top: 34,
            right: 6,
            zIndex: Z,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "flex-end",
            pointerEvents: "none",
          }}
        >
          <div style={hintStyle}>Ctrl+clic → VS Code</div>
          <div style={hintStyle}>Maj + clic : sélection multiple</div>
        </div>
      )}

      {isActive && hasSelection && (
        <div
          data-pathpicker-ignore=""
          role="status"
          style={{
            ...hintStyle,
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: Z,
            pointerEvents: "none",
          }}
        >
          Entrée pour valider
        </div>
      )}

      {toast && (
        <div
          data-pathpicker-ignore=""
          role="status"
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            zIndex: Z,
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            color: "#fff",
            background: SOLID_BG,
            border: PANEL_BORDER,
            boxShadow: TOOLTIP_SHADOW,
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
};
