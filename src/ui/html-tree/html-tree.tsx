import { useCallback, useEffect, useReducer, useRef, useState, type FC } from "react";

import { IGNORE_ATTR } from "../../core/inspector/constants/behavior";
import { ancestorsUpTo, isElementSkippable } from "../../core/devpanel/dom-tree";
import {
  getInspected,
  onSelectRequest,
  requestDisarm,
  setInspected,
  setTreeSelectMode,
  subscribeInspected,
} from "../../core/devpanel/inspected";
import { createSearchHighlight, type SearchHighlight } from "../../core/search/highlight";
import { TreeNode } from "./tree-node";

/**
 * Arbre DOM live (onglet HTML du panneau, façon DevTools Elements) : repliable
 * depuis `<body>`, surligne l'élément au survol (réutilise `createSearchHighlight`),
 * sélectionne au clic, se met à jour via `MutationObserver`. Exclut l'UI render-picker.
 */
export const HtmlTree: FC = () => {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [expanded, setExpanded] = useState<Set<Element>>(() =>
    typeof document !== "undefined" && document.body ? new Set([document.body]) : new Set(),
  );
  const [selected, setSelected] = useState<Element | null>(null); // sélection = clic uniquement (ligne bleue)
  const [revealed, setRevealed] = useState<Element | null>(null); // cible inspect/survol : déplie + scroll, SANS sélectionner
  const highlightRef = useRef<SearchHighlight | null>(null);
  const selectedRef = useRef<Element | null>(null);
  selectedRef.current = selected;
  const selectedRowRef = useRef<HTMLDivElement | null>(null);

  // Couche de highlight (créée au montage, détruite au démontage).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const h = createSearchHighlight();
    highlightRef.current = h;
    return () => {
      h.destroy();
      highlightRef.current = null;
    };
  }, []);

  // Live : rafraîchit l'arbre quand le DOM change, en ignorant nos propres mutations
  // (rects de highlight) pour ne pas boucler. Débounce léger.
  useEffect(() => {
    if (typeof MutationObserver === "undefined" || !document.body) return;
    let timer: number | null = null;
    const obs = new MutationObserver((muts) => {
      const relevant = muts.some((m) => {
        const t = m.target;
        const el = t instanceof Element ? t : t.parentElement;
        return !el || el.closest(`[${IGNORE_ATTR}]`) === null;
      });
      if (!relevant || timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        force();
      }, 120);
    });
    obs.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    return () => {
      obs.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  // Révèle dans l'arbre l'élément survolé/piqué par l'inspecteur (déplie les
  // ancêtres + sélectionne) — comme DevTools. Le highlight page est déjà dessiné
  // par l'overlay de l'inspecteur, donc pas de rect ici.
  useEffect(() => {
    const reveal = (el: Element | null) => {
      if (!el || !document.body || !document.body.contains(el) || isElementSkippable(el)) {
        return;
      }
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const a of ancestorsUpTo(el, document.body)) next.add(a);
        next.add(el); // déplie aussi la div ciblée : on « rentre » dedans (enfants visibles)
        return next;
      });
      setRevealed(el); // révèle (déplie + scroll) sans sélectionner — la sélection bleue = clic
    };
    reveal(getInspected());
    const unsub = subscribeInspected(reveal);
    // À la sortie de l'onglet HTML (démontage) : on oublie l'élément inspecté pour ne
    // PAS re-sélectionner (ligne bleue) la dernière div au retour sur l'onglet.
    return () => {
      unsub();
      setInspected(null);
    };
  }, []);

  // Clic hors d'une ligne de l'arbre → désélectionne (la sélection bleue = clic sur ligne).
  useEffect(() => {
    const onDown = (e: Event) => {
      const path = e.composedPath?.() ?? [];
      const onRow = path.some(
        (n) => n instanceof Element && n.hasAttribute?.("data-rp-tree-row"),
      );
      if (onRow) return;
      setSelected(null);
      setRevealed(null);
      highlightRef.current?.clear();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  // Scrolle la ligne « focus » (révélée par inspect, sinon sélectionnée) dans la vue.
  useEffect(() => {
    if (revealed || selected) selectedRowRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [revealed, selected]);

  const toggle = useCallback((el: Element) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(el)) next.delete(el);
      else next.add(el);
      return next;
    });
  }, []);

  const onHover = useCallback((el: Element | null) => {
    const h = highlightRef.current;
    if (!h) return;
    const target = el ?? selectedRef.current;
    if (target) {
      h.update([target as HTMLElement]);
      h.setActive([0]);
    } else {
      h.clear();
    }
  }, []);

  const onSelect = useCallback((el: Element) => {
    setSelected(el);
    setRevealed(null); // le clic prend la main sur le focus (ligne bleue)
    requestDisarm(); // fige la sélection : stoppe l'inspect-au-survol du picker
    const h = highlightRef.current;
    if (h) {
      h.update([el as HTMLElement]);
      h.setActive([0]);
    }
  }, []);

  // Sélection depuis un clic sur la page (mode HTML) : déplie jusqu'à l'élément,
  // le sélectionne (bleu) + le surligne, sans désarmer (on peut cliquer d'autres).
  const selectEl = useCallback((el: Element) => {
    if (!document.body || !document.body.contains(el) || isElementSkippable(el)) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const a of ancestorsUpTo(el, document.body!)) next.add(a);
      next.add(el);
      return next;
    });
    setRevealed(null);
    setSelected(el);
    const h = highlightRef.current;
    if (h) {
      h.update([el as HTMLElement]);
      h.setActive([0]);
    }
  }, []);

  // Mode « sélection dans l'arbre » actif tant que l'onglet HTML est monté + réception
  // des clics page → sélection.
  useEffect(() => {
    setTreeSelectMode(true);
    const unsub = onSelectRequest(selectEl);
    return () => {
      setTreeSelectMode(false);
      unsub();
    };
  }, [selectEl]);

  if (typeof document === "undefined" || !document.body) return null;

  return (
    <div
      onMouseLeave={() => onHover(null)}
      style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}
    >
      <TreeNode
        el={document.body}
        depth={0}
        expanded={expanded}
        toggle={toggle}
        selected={selected}
        focusEl={revealed ?? selected}
        onSelect={onSelect}
        onHover={onHover}
        selectedRowRef={selectedRowRef}
      />
      {/* Espace permanent en bas : le nœud révélé ne colle jamais au bord bas. */}
      <div aria-hidden style={{ height: 120 }} />
    </div>
  );
};
