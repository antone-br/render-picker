import { useCallback, useEffect, useReducer, useRef, useState, type FC } from "react";

import { IGNORE_ATTR } from "../../core/inspector/constants/behavior";
import { ancestorsUpTo, isElementSkippable } from "../../core/devpanel/dom-tree";
import {
  getInspected,
  onContextMenuRequest,
  onSelectRequest,
  setInspected,
  setTreeSelectMode,
  subscribeInspected,
} from "../../core/devpanel/inspected";
import { createSearchHighlight, type SearchHighlight } from "../../core/search/highlight";
import { formatHtml } from "../../core/format";
import { serializeWithComputedStyles } from "../../core/computed-html";
import { getXPath } from "../../core/inspector/xpath";
import { ContextMenu } from "../context-menu";
import { CopyIcon } from "../icons";
import { TreeNode } from "./tree-node";

const writeClip = (t: string) => {
  navigator.clipboard?.writeText(t).catch(() => {});
};

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
  const [menu, setMenu] = useState<{ el: Element; x: number; y: number } | null>(null);
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
      // Le clic droit (ouverture d'un menu contextuel) ne désélectionne jamais.
      if ("button" in e && (e as MouseEvent).button !== 0) return;
      const path = e.composedPath?.() ?? [];
      // Garde la sélection si le clic est sur une ligne OU dans le menu contextuel.
      const keep = path.some(
        (n) =>
          n instanceof Element &&
          (n.hasAttribute?.("data-rp-tree-row") || n.hasAttribute?.("data-rp-contextmenu")),
      );
      if (keep) return;
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
    const sel = selectedRef.current;
    if (el && sel && el !== sel) {
      // Garde le rect sélectionné (net, foncé) + ajoute un rect plus clair sur le survolé.
      h.update([sel as HTMLElement, el as HTMLElement]);
      h.setActive([0]);
    } else if (el) {
      h.update([el as HTMLElement]);
      h.setActive([0]);
    } else if (sel) {
      // Sortie du survol : on ne retire pas le rect sélectionné.
      h.update([sel as HTMLElement]);
      h.setActive([0]);
    } else {
      h.clear();
    }
  }, []);

  const onSelect = useCallback((el: Element) => {
    setSelected(el);
    setRevealed(null); // le clic prend la main sur le focus (ligne bleue) ; le mode inspect reste actif
    const h = highlightRef.current;
    if (h) {
      h.update([el as HTMLElement]);
      h.setActive([0]);
    }
  }, []);

  // Sélection depuis un clic sur la page (mode HTML) : déplie jusqu'à l'élément,
  // le sélectionne (bleu) + le surligne, puis désarme (stoppe l'inspect-au-survol).
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
    const unsubSel = onSelectRequest(selectEl);
    // Clic droit sur la page (mode HTML) → ouvre le menu de l'arbre au curseur.
    const unsubCtx = onContextMenuRequest((el, x, y) => {
      if (!document.body?.contains(el) || isElementSkippable(el)) return;
      setMenu({ el, x, y });
    });
    return () => {
      setTreeSelectMode(false);
      unsubSel();
      unsubCtx();
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
        onContextMenu={(e, el) => setMenu({ el, x: e.clientX, y: e.clientY })}
        selectedRowRef={selectedRowRef}
      />
      {/* Espace permanent en bas : le nœud révélé ne colle jamais au bord bas. */}
      <div aria-hidden style={{ height: 120 }} />

      <ContextMenu
        at={menu ? { el: menu.el as HTMLElement, x: menu.x, y: menu.y } : null}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                {
                  label: "Copier le HTML",
                  onClick: () => {
                    writeClip(formatHtml((menu.el as HTMLElement).outerHTML));
                    setMenu(null);
                  },
                },
                {
                  label: "Copier le rendu",
                  icon: <CopyIcon />,
                  info: "HTML autoportant : styles inline + classes/variables en commentaire. Se colle partout sans le CSS de la page.",
                  onClick: () => {
                    writeClip(serializeWithComputedStyles(menu.el));
                    setMenu(null);
                  },
                },
                {
                  label: "Copier les classes",
                  disabled: (menu.el.getAttribute("class") ?? "").trim() === "",
                  onClick: () => {
                    writeClip((menu.el.getAttribute("class") ?? "").trim().replace(/\s+/g, " "));
                    setMenu(null);
                  },
                },
                {
                  label: "Copier le XPath",
                  onClick: () => {
                    writeClip(getXPath(menu.el));
                    setMenu(null);
                  },
                },
              ]
            : []
        }
      />
    </div>
  );
};
