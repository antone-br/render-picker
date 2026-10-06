import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { searchElements } from "../core/search/element-search";
import { createSearchHighlight } from "../core/search/highlight";
import {
  ELEVATED_BG,
  CARD_SHADOW,
  MUTED,
  HOVER_BG,
} from "../core/inspector/constants/theme";

const POPOVER_ATTR = "data-rp-search-popover";

export interface SearchPopoverProps {
  /** Ferme la recherche (bouton, changement de page, clic hors du popover). */
  onClose: () => void;
}

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

/**
 * Recherche d'éléments (tag / classe / sélecteur CSS) : panneau remontant
 * au-dessus de la barre du bas. Chaque résultat est **mis en avant** sur la page
 * avec le rect de survol de l'inspecteur (suivi scroll/resize en continu) ;
 * l'élément actif (↑/↓ ou survol de la ligne) porte le rect le plus net,
 * Entrée le scrolle dans le viewport. Échap ferme. Interactive même picker armé.
 */
export function SearchPopover({ onClose }: SearchPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  // Cap interne (SEARCH_MAX_RESULTS) : la liste reste lisible sur les grosses pages.
  const results = useMemo(() => searchElements(query), [query]);
  const highlightRef = useRef<ReturnType<typeof createSearchHighlight> | null>(null);

  // Autofocus à l'ouverture + couche de highlights (détruite à la fermeture).
  useEffect(() => {
    inputRef.current?.focus();
    ref.current?.animate?.(
      [
        { opacity: 0, transform: "scale(.95) translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 120, easing: "ease-out" },
    );
    const highlight = createSearchHighlight();
    highlightRef.current = highlight;
    return () => {
      highlight.destroy();
      highlightRef.current = null;
    };
  }, []);

  // Les rects suivent la recherche et l'élément actif.
  useEffect(() => {
    highlightRef.current?.update(results);
  }, [results]);
  useEffect(() => {
    highlightRef.current?.setActive(index);
  }, [index, results]);

  // Fermeture au clic hors du popover (composedPath → traverse aussi le shadow DOM).
  useEffect(() => {
    const onDown = (e: Event) => {
      const path = e.composedPath?.() ?? [];
      const inside = path.some(
        (n) => n instanceof Element && n.hasAttribute?.(POPOVER_ATTR),
      );
      if (!inside) onCloseRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  const locate = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (results.length === 0) return;
      e.preventDefault();
      const next =
        e.key === "ArrowDown"
          ? (index + 1) % results.length
          : (index - 1 + results.length) % results.length;
      setIndex(next);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation(); // Pas de confirmation de sélection multiple côté inspecteur.
      const el = results[index] ?? results[0];
      if (el) locate(el);
    }
    // Échap : laisse-propager → désarme aussi (sémantique « Échap désarme toujours »).
  };

  const labelOf = (el: HTMLElement) => {
    const tag = el.tagName.toLowerCase();
    const cls =
      typeof el.className === "string" && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
        : "";
    const text = (el.textContent?.trim().slice(0, 40) || "").replace(/\s+/g, " ");
    return { tag, cls, text };
  };

  return (
    <div
      ref={ref}
      data-pathpicker-ignore=""
      data-rp-search-popover=""
      style={{
        position: "fixed",
        bottom: 70,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2147483640,
        background: ELEVATED_BG,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        boxShadow: CARD_SHADOW,
        padding: 6,
        display: "flex",
        flexDirection: "column",
        width: 320,
        maxHeight: 320,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px" }}>
        <input
          ref={inputRef}
          role="searchbox"
          placeholder="tag, .classe ou sélecteur CSS (div.card)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={onKeyDown}
          style={{
            flex: 1,
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            color: "#fff",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: "5px 8px",
            outline: "none",
            minWidth: 0,
          }}
        />
        <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>
          {results.length}
        </span>
      </div>

      <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", paddingTop: 4 }}>
        {query.trim() === "" && (
          <div style={{ ...rowStyle, color: MUTED }}>
            Rechercher par tag (div), classe (.card) ou sélecteur CSS.
          </div>
        )}
        {query.trim() !== "" && results.length === 0 && (
          <div style={{ ...rowStyle, color: MUTED }}>Aucun résultat</div>
        )}
        {results.map((el, i) => {
          const { tag, cls, text } = labelOf(el);
          const value = `${tag}${cls}`;
          return (
            <div
              key={i}
              role="option"
              aria-selected={i === index}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                setQuery(value);
                setIndex(0);
                inputRef.current?.focus();
              }}
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
                }}
              >
                <b style={{ fontWeight: 600 }}>{tag}</b>
                <span style={{ opacity: 0.7 }}>{cls}</span>
              </span>
              <span
                style={{
                  color: MUTED,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 150,
                }}
              >
                {text}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          ...rowStyle,
          color: MUTED,
          fontSize: 10,
          padding: "4px 8px 2px",
          justifyContent: "flex-start",
        }}
      >
        Clic : affiner · Entrée : localiser (scroll) · Échap : fermer
      </div>
    </div>
  );
}
