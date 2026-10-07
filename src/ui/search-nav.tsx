import type { FC } from "react";

import {
  CARD_SHADOW,
  ELEVATED_BG,
  MUTED,
  SECONDARY_BG_HOVER,
  SECONDARY_BORDER,
  SECONDARY_SURFACE,
  TOOLTIP_SHADOW,
} from "../core/inspector/constants/theme";
import { ChevronIcon } from "./icons";

/** Props de `SearchNav` (boîte flottante compteur + navigation). */
export interface SearchNavProps {
  /** Position courante — `"1/3"` ou nombre brut de résultats. */
  counter: string;
  /** Aucune occurrence navigable → flèches inertes. */
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Carte flottante distincte, à droite du popover de recherche : affiche le
 * compteur d'occurrences et les flèches précédent/suivant. Porte
 * `data-rp-search-ui` (clic dedans ne ferme pas le popover) et
 * `data-pathpicker-ignore` (non pickable par l'inspecteur).
 */
export const SearchNav: FC<SearchNavProps> = ({ counter, disabled, onPrev, onNext }) => (
  <div
    data-pathpicker-ignore=""
    data-rp-search-ui=""
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: ELEVATED_BG,
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 8,
      boxShadow: CARD_SHADOW,
      padding: 6,
    }}
  >
    <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{counter}</span>
    {[
      { dir: "left" as const, onClick: onPrev, label: "Occurrence précédente" },
      { dir: "right" as const, onClick: onNext, label: "Occurrence suivante" },
    ].map(({ dir, onClick, label }) => (
      <button
        key={dir}
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.background = SECONDARY_BG_HOVER;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = SECONDARY_SURFACE;
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 6,
          cursor: disabled ? "default" : "pointer",
          background: SECONDARY_SURFACE,
          border: SECONDARY_BORDER,
          boxShadow: TOOLTIP_SHADOW,
          opacity: disabled ? 0.4 : 1,
          color: "#fff",
          padding: 0,
        }}
      >
        <ChevronIcon dir={dir} color="#fff" />
      </button>
    ))}
  </div>
);
