import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import {
  classPrefixOf,
  groupResults,
  searchElements,
  SEARCH_UI_ATTR,
} from "../../core/search/element-search";
import { makeQueryHistory } from "../../core/search/query-history";
import { createSearchHighlight } from "../../core/search/highlight";
import { vscodeOpenFor } from "../../core/dev/click-to-source";
import { ELEVATED_BG, CARD_SHADOW } from "../../core/inspector/constants/theme";
import { useOutsideClose } from "../use-outside-close";
import { ResultList } from "./results";
import { SearchNav } from "./nav";

export interface SearchPopoverProps {
  /** Ferme la recherche (bouton, changement de page, clic hors du popover). */
  onClose: () => void;
  /** Clic sur un rect highlight → copie du snippet enrichi côté appelant. */
  onPickElement?: (el: HTMLElement) => void;
  /** Clic droit sur un rect highlight → menu contextuel (copier HTML / classes). */
  onContextMenuElement?: (el: HTMLElement, pos: { x: number; y: number }) => void;
}

/**
 * Recherche d'éléments (tag / classe / sélecteur CSS) : carte remontant au-dessus
 * de la barre du bas. Les résultats sont surlignés sur la page (couche highlight) ;
 * la liste groupée vit dans `./results`, la navigation dans `./nav`. Échap ferme.
 */
export function SearchPopover({
  onClose,
  onPickElement,
  onContextMenuElement,
}: SearchPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onPickRef = useRef(onPickElement);
  const onContextMenuRef = useRef(onContextMenuElement);
  onPickRef.current = onPickElement;
  onContextMenuRef.current = onContextMenuElement;

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  /** Ligne de suggestion survolée (souris) ; `-1` = aucune (tous les rects visibles). */
  const [rowHover, setRowHover] = useState(-1);
  /** Occurrence courante dans le groupe actif (cycling via flèches/↑/↓). */
  const [member, setMember] = useState(0);
  // Undo/redo maison : l'input contrôlé + les changements programmatiques (clic
  // suggestion) ne remontent pas via l'undo natif du navigateur.
  const historyRef = useRef(makeQueryHistory(""));
  const commit = useCallback((next: string) => {
    historyRef.current.push(next);
    setQuery(next);
  }, []);
  const stepHistory = useCallback((forward: boolean) => {
    const history = historyRef.current;
    const moved = forward ? history.redo() : history.undo();
    if (!moved) return;
    setQuery(history.current);
    setIndex(0);
    setMember(0);
  }, []);
  // Cap interne (SEARCH_MAX_RESULTS) : la liste reste lisible sur les grosses pages.
  const results = useMemo(() => searchElements(query), [query]);
  // Suggestions = sélecteurs regroupés ; le token matchant la frappe partielle
  // part en tête de clé (sinon invisible au-delà de la 3e classe).
  const prefix = useMemo(() => classPrefixOf(query) ?? "", [query]);
  const groups = useMemo(() => groupResults(results, prefix), [results, prefix]);
  const highlightRef = useRef<ReturnType<typeof createSearchHighlight> | null>(null);

  // Autofocus à l'ouverture + couche de highlights (détruite à la fermeture).
  useEffect(() => {
    inputRef.current?.focus();
    ref.current?.animate?.(
      [
        { opacity: 0, transform: "translateX(-50%) scale(.95) translateY(4px)" },
        { opacity: 1, transform: "translateX(-50%)" },
      ],
      { duration: 120, easing: "ease-out" },
    );
    const highlight = createSearchHighlight({
      onPick: (el) => onPickRef.current?.(el),
      onContextMenu: (el, pos) => onContextMenuRef.current?.(el, pos),
      onVscode: (el, action) => vscodeOpenFor(el, action),
    });
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
    const highlight = highlightRef.current;
    if (!highlight) return;
    const group = groups[index];
    // Engagement find-bar : une seule occurrence est « courante » (rect net),
    // les autres matches du groupe restent translucides.
    const currentFlat =
      group && group.indices.length > 0
        ? group.indices[((member % group.indices.length) + group.indices.length) % group.indices.length]!
        : -1;
    highlight.setActive(currentFlat === -1 ? [] : [currentFlat]);
    highlight.setFilter(rowHover === -1 ? null : (groups[rowHover]?.indices ?? null));
  }, [index, groups, rowHover, member]);

  // Fermeture au clic hors du popover (toute surface `data-rp-search-ui`).
  useOutsideClose(SEARCH_UI_ATTR, onClose);

  const locate = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /** Occurrence m du groupe actif : déplace le rect net, SANS scroller le site (Entrée localise). */
  const stepTo = (m: number) => {
    const group = groups[index];
    if (!group || group.indices.length === 0) return;
    setMember(((m % group.indices.length) + group.indices.length) % group.indices.length);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const metaHeld = e.ctrlKey || e.metaKey;
    if (metaHeld && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) stepHistory(true);
      else stepHistory(false);
      return;
    }
    if (metaHeld && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      e.stopPropagation();
      stepHistory(true);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const group = groups[index];
      if (!group || group.indices.length === 0) return;
      e.preventDefault();
      stepTo(member + (e.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation(); // Pas de confirmation de sélection multiple côté inspecteur.
      const group = groups[index];
      if (!group || group.indices.length === 0) return;
      const m = ((member % group.indices.length) + group.indices.length) % group.indices.length;
      locate(results[group.indices[m]!]!);
    }
    // Échap : laisse-propager → désarme aussi (sémantique « Échap désarme toujours »).
  };

  return (
    // Carte centrée sur le viewport = alignée avec la barre du bas (elle aussi
    // `left:50% translateX(-50%)`). La nav est un enfant `absolute` → elle ne
    // décale pas le centrage de la carte.
    <div
      ref={ref}
      data-pathpicker-ignore=""
      data-rp-search-popover=""
      data-rp-search-ui=""
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
            commit(e.target.value);
            setIndex(0);
            setMember(0);
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
      </div>

      <ResultList
        query={query}
        results={results}
        groups={groups}
        index={index}
        onHoverRow={(i) => {
          setIndex(i);
          setRowHover(i);
        }}
        onLeave={() => setRowHover(-1)}
        onPick={(selector) => {
          commit(selector);
          setIndex(0);
          setMember(0);
          inputRef.current?.focus();
        }}
      />

      {/* Nav en enfant `absolute`, collée à droite et alignée en haut sur la ligne input. */}
      <div style={{ position: "absolute", left: "calc(100% + 8px)", top: 0 }}>
        <SearchNav
          counter={
            groups[index] && groups[index]!.count > 0
              ? `${((member % groups[index]!.count) + groups[index]!.count) % groups[index]!.count + 1}/${groups[index]!.count}`
              : String(results.length)
          }
          disabled={groups.length === 0}
          onPrev={() => stepTo(member - 1)}
          onNext={() => stepTo(member + 1)}
        />
      </div>
    </div>
  );
}
