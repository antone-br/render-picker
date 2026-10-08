import { useState, type FC } from "react";

import { MUTED } from "../../core/inspector/constants/theme";
import type { NetEntry } from "../../core/devpanel/store";
import { NetDetail, statusColor } from "./net-detail";

/** Onglet Network : liste des requêtes, lignes dépliables vers `NetDetail`. */
export const NetworkTab: FC<{ requests: NetEntry[] }> = ({ requests }) => {
  const [openRows, setOpenRows] = useState<Set<number>>(() => new Set());
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        fontFamily: "ui-monospace, Menlo, monospace",
      }}
    >
      {requests.length === 0 && <span style={{ color: MUTED }}>Aucune requête.</span>}
      {requests.map((r, i) => {
        const open = openRows.has(i);
        return (
          <div key={i}>
            <div
              onClick={() =>
                setOpenRows((prev) => {
                  const next = new Set(prev);
                  next.has(i) ? next.delete(i) : next.add(i);
                  return next;
                })
              }
              style={{ display: "flex", gap: 8, cursor: "pointer", wordBreak: "break-all" }}
            >
              <span style={{ color: MUTED, width: 10 }}>{open ? "▾" : "▸"}</span>
              <span style={{ color: statusColor(r), minWidth: 34 }}>{r.status || "ERR"}</span>
              <span style={{ color: MUTED, minWidth: 42 }}>{r.method}</span>
              <span style={{ color: "#fff", flex: 1 }}>{r.url}</span>
              <span style={{ color: MUTED }}>{r.durationMs}ms</span>
            </div>
            {open && <NetDetail r={r} />}
          </div>
        );
      })}
    </div>
  );
};
