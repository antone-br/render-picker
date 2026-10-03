import { useEffect, useState } from "react";

import { DEFAULT_SETTINGS, type RenderPickerSettings } from "../../../src/core/settings";
import { SettingsMenu } from "../../../src/ui/settings-menu";
import { saveCommands } from "../storage";

type Commands = RenderPickerSettings["commands"];

/** Page d'options : commandes par défaut (chrome.storage). */
export function OptionsPage() {
  const [commands, setCommands] = useState<Commands>(DEFAULT_SETTINGS.commands);

  useEffect(() => {
    void chrome.storage.sync.get("commands").then((got) => {
      if (got.commands) setCommands(got.commands as Commands);
    });
  }, []);

  const onCommands = (c: Commands) => {
    setCommands(c);
    saveCommands(c);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#18181b",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        alignItems: "flex-start",
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>render-picker</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Commandes par défaut</span>
        <div style={{ position: "relative" }}>
          <SettingsMenu
            commands={commands}
            onChangeCommands={onCommands}
            onClose={() => {}}
            showVsCode={false}
          />
        </div>
      </div>
    </div>
  );
}
