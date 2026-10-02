import {
  BTN_PRIMARY_SHADOW,
  BTN_SHADOW,
  CHECKBOX_BORDER,
  CHECKBOX_CHECKED_BG,
} from "../core/inspector/pick-style";
import { CheckIcon } from "./icons";

/** Checkbox présentational, UI reprise de renderflow (form/checkbox.tsx). */
export function Pickbox({ checked }: { checked: boolean }) {
  return (
    <span
      style={{
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        width: 16,
        height: 16,
        borderRadius: 4,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: checked ? CHECKBOX_CHECKED_BG : "rgba(255,255,255,0.04)",
        border: checked ? "1px solid transparent" : `1px solid ${CHECKBOX_BORDER}`,
        boxShadow: checked ? BTN_PRIMARY_SHADOW : BTN_SHADOW,
        transition: "background 120ms, box-shadow 120ms, border-color 120ms",
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: checked
            ? "linear-gradient(to bottom, rgba(255,255,255,0.16), transparent)"
            : "linear-gradient(to bottom, rgba(255,255,255,0.06), transparent)",
        }}
      />
      {checked && <CheckIcon />}
    </span>
  );
}
