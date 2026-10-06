import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { searchElements } from "../core/search/element-search";
import {
  ELEVATED_BG,
  CARD_SHADOW,
  MUTED,
  HOVER_BG,
} from "../core/inspector/constants/theme";

const POPOVER_ATTR = "data-rp-search-popover";

export interface SearchPopoverProps {
  /** Active le résultat (click ou Entrée) — scroll + flash + transcription via `onActivate`. */
  onActivate: (el: HTMLElement) => void;
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
 * Recherche d'éléments (tag / classe / sélecteur CSS) : panneau remontant,
 * au-dessus de la barre du bas. Entrée = activer le résultat (copie du
 * snippet enrichi côté appelant), Échap ferme. Interactive même picker armé.
 */
export function SearchPopover({ onActivate, onClose }: SearchPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const onActivateRef = useRef(onActivate);
  onCloseRef.current = onClose;
  onActivateRef.current = onActivate;

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  // Cap interne (SEARCH_MAX_RESULTS) : la liste reste lisible sur les grosses pages.
  const results = useMemo(() => searchElements(query), [query]);

  // Autofocus à l'ouverture.
  useEffect(() => {
    inputRef.current?.focus();
    ref.current?.animate?.(
      [
        { opacity: 0, transform: "scale(.95) translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 120, easing: "ease-out" },
    );
  }, []);

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

  const activate = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const prevOutline = el.style.outline;
    el.style.outline = "2px solid #3b82f6";
    setTimeout(() => {
      el.style.outline = prevOutline;
    }, 400);
    onActivateRef.current(el);
    onCloseRef.current();
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
      if (el) activate(el);
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
          {results.length === results.length ? `${results.length}` : `${results.length}/${results.length}+`}
        </span>
      </div>

      <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", paddingTop: 4 }}>
        {query.trim() === "" && (
          <div style={{ ...rowStyle, color: MUTED }}>
            Rechercher par tag (`div`), classe (`.card`) ou sélecteur.
          </div>
        )}
        {query.trim() !== "" && results.length === 0 && (
          <div style={{ ...rowStyle, color: MUTED }}>Aucun résultat</div>
        )}
        {results.map((el, i) => {
          const { tag, cls, text } = labelOf(el);
          return (
            <div
              key={i}
              role="option"
              aria-selected={i === index}
              onMouseEnter={() => setIndex(i)}
              onClick={() => activate(el)}
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
        Entrée : recopier dans le presse-papiers · Échap : fermer
      </div>
    </div>
  );
}
