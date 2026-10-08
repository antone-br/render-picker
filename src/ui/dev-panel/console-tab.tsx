import { useRef, useState, type FC } from "react";

import type { LogEntry } from "../../core/devpanel/store";
import { runConsoleExpression } from "../../core/devpanel/console-eval";
import { LEVEL_COLOR } from "./styles";

/**
 * Onglet Console : liste des logs capturés + prompt REPL inline (dans le flux,
 * comme DevTools). Entrée évalue ; ↑/↓ parcourent l'historique (en mémoire).
 */
export const ConsoleTab: FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const [cmd, setCmd] = useState("");
  const history = useRef<string[]>([]);
  const histIndex = useRef(-1); // -1 = édition courante (hors historique)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        fontFamily: "ui-monospace, Menlo, monospace",
      }}
    >
      {logs.map((l, i) => (
        <div
          key={i}
          style={{ color: LEVEL_COLOR[l.level], whiteSpace: "pre-wrap", wordBreak: "break-all" }}
        >
          {l.text}
        </div>
      ))}
      {/* Prompt REPL dans le flux des logs (comme DevTools) : évalue du JS dans la page. */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#60a5fa" }}>›</span>
        <input
          aria-label="Console REPL"
          value={cmd}
          placeholder="expression JS"
          onChange={(e) => {
            setCmd(e.target.value);
            histIndex.current = -1;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              const code = cmd.trim();
              if (!code) return;
              runConsoleExpression(code);
              history.current.push(code);
              histIndex.current = -1;
              setCmd("");
              return;
            }
            if (e.key === "ArrowUp") {
              if (history.current.length === 0) return;
              e.preventDefault();
              const next =
                histIndex.current === -1
                  ? history.current.length - 1
                  : Math.max(0, histIndex.current - 1);
              histIndex.current = next;
              setCmd(history.current[next]!);
              return;
            }
            if (e.key === "ArrowDown") {
              if (histIndex.current === -1) return;
              e.preventDefault();
              const next = histIndex.current + 1;
              if (next >= history.current.length) {
                histIndex.current = -1;
                setCmd("");
              } else {
                histIndex.current = next;
                setCmd(history.current[next]!);
              }
              return;
            }
          }}
          style={{
            flex: 1,
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 11,
            color: "#fff",
            background: "transparent",
            border: "none",
            outline: "none",
            padding: 0,
            minWidth: 0,
          }}
        />
      </div>
    </div>
  );
};
