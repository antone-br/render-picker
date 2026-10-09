import type { FC, MouseEvent as ReactMouseEvent, RefObject } from "react";

import { SELECTED_BG } from "../../core/inspector/constants/picker";
import { MUTED } from "../../core/inspector/constants/theme";
import { inlineText, nodeLabel, visibleChildren } from "../../core/devpanel/dom-tree";
import { ATTR_NAME, ATTR_VAL, HOVER_BG, INDENT, TAG, TEXT } from "./tree-colors";

/** Label coloré `<tag id="…" class="…">` d'un élément. */
const NodeTag: FC<{ el: Element }> = ({ el }) => {
  const { tag, id, classes } = nodeLabel(el);
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <span style={{ color: MUTED }}>&lt;</span>
      <span style={{ color: TAG }}>{tag}</span>
      {id && (
        <span>
          {" "}
          <span style={{ color: ATTR_NAME }}>id</span>
          <span style={{ color: MUTED }}>=</span>
          <span style={{ color: ATTR_VAL }}>&quot;{id}&quot;</span>
        </span>
      )}
      {classes.length > 0 && (
        <span>
          {" "}
          <span style={{ color: ATTR_NAME }}>class</span>
          <span style={{ color: MUTED }}>=</span>
          <span style={{ color: ATTR_VAL }}>&quot;{classes.join(" ")}&quot;</span>
        </span>
      )}
      <span style={{ color: MUTED }}>&gt;</span>
    </span>
  );
};

export interface TreeNodeProps {
  el: Element;
  depth: number;
  expanded: Set<Element>;
  toggle: (el: Element) => void;
  selected: Element | null;
  /** Ligne à scroller dans la vue (révélée par inspect, sinon sélectionnée). */
  focusEl: Element | null;
  onSelect: (el: Element) => void;
  onHover: (el: Element | null) => void;
  onContextMenu: (e: ReactMouseEvent, el: Element) => void;
  selectedRowRef: RefObject<HTMLDivElement | null>;
}

/** Ligne d'un nœud + ses enfants (récursif, rendu lazy si déplié). */
export const TreeNode: FC<TreeNodeProps> = ({
  el,
  depth,
  expanded,
  toggle,
  selected,
  focusEl,
  onSelect,
  onHover,
  onContextMenu,
  selectedRowRef,
}) => {
  const children = visibleChildren(el);
  const hasChildren = children.length > 0;
  const isOpen = expanded.has(el);
  const text = hasChildren ? null : inlineText(el);

  return (
    <>
      <div
        ref={focusEl === el ? selectedRowRef : undefined}
        data-rp-tree-row=""
        onMouseEnter={(e) => {
          onHover(el);
          if (selected !== el) e.currentTarget.style.background = HOVER_BG;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = selected === el ? SELECTED_BG : "transparent";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(el);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, el);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: 2 + depth * INDENT,
          cursor: "pointer",
          borderRadius: 3,
          background: selected === el ? SELECTED_BG : "transparent",
          whiteSpace: "nowrap",
        }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              toggle(el);
            }}
            style={{ color: MUTED, width: 12, flex: "0 0 12px", cursor: "pointer" }}
          >
            {isOpen ? "▾" : "▸"}
          </span>
        ) : (
          <span style={{ width: 12, flex: "0 0 12px" }} />
        )}
        <NodeTag el={el} />
        {text && <span style={{ color: TEXT, marginLeft: 4 }}>{text}</span>}
        {hasChildren && !isOpen && <span style={{ color: MUTED }}>…</span>}
      </div>

      {hasChildren &&
        isOpen &&
        children.map((child, i) => (
          <TreeNode
            key={i}
            el={child}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
            selected={selected}
            focusEl={focusEl}
            onSelect={onSelect}
            onHover={onHover}
            onContextMenu={onContextMenu}
            selectedRowRef={selectedRowRef}
          />
        ))}
    </>
  );
};
