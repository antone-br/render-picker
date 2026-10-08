import type { FC } from "react";

import { HOVER_BG, MUTED } from "../../core/inspector/constants/theme";
import type { SearchGroup } from "../../core/search/element-search";

const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "4px 8px",
  fontSize: 11,
  color: "#fff",
  fontFamily: "system-ui, sans-serif",
} as const;

export interface ResultListProps {
  query: string;
  results: HTMLElement[];
  groups: SearchGroup[];
  index: number;
  /** Survol d'une ligne (met l'index actif + la ligne survolée). */
  onHoverRow: (i: number) => void;
  /** Sortie de la liste (réinitialise le survol). */
  onLeave: () => void;
  /** Clic sur une ligne → applique le sélecteur du groupe. */
  onPick: (selector: string) => void;
}

/** Liste des groupes de résultats (tag.classes + composant + compteur). */
export const ResultList: FC<ResultListProps> = ({
  query,
  results,
  groups,
  index,
  onHoverRow,
  onLeave,
  onPick,
}) => (
  <div
    style={{ overflowY: "auto", display: "flex", flexDirection: "column", paddingTop: 4 }}
    onMouseLeave={onLeave}
  >
    {query.trim() === "" && (
      <div style={{ ...rowStyle, color: MUTED }}>
        Rechercher par tag (div), classe (.card) ou sélecteur CSS.
      </div>
    )}
    {query.trim() !== "" && groups.length === 0 && (
      <div style={{ ...rowStyle, color: MUTED }}>Aucun résultat</div>
    )}
    {groups.map((g, i) => {
      const first = results[g.indices[0]!]!;
      const component =
        first.closest("[data-component]")?.getAttribute("data-component") ?? null;
      return (
        <div
          key={g.key}
          role="option"
          aria-selected={i === index}
          onMouseEnter={() => onHoverRow(i)}
          onClick={() => onPick(g.selector)}
          style={{
            ...rowStyle,
            cursor: "pointer",
            background: i === index ? HOVER_BG : "transparent",
            borderRadius: 6,
          }}
        >
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            <b style={{ fontWeight: 600 }}>{g.tag}</b>
            <span style={{ opacity: 0.7 }}>{g.cls}</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                color: "#93c5fd",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 110,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {component}
            </span>
            <span
              style={{
                color: "#60a5fa",
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 4,
                padding: "0 5px",
                font: "600 10px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace",
                whiteSpace: "nowrap",
              }}
            >
              ×{g.count}
            </span>
          </span>
        </div>
      );
    })}
  </div>
);
