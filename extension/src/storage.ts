import { DEFAULT_SETTINGS, type RenderPickerSettings } from "../../src/core/settings";

/**
 * Persistance des réglages via `chrome.storage.sync` (remplace localStorage + la
 * route API du package npm). Expose un snapshot **synchrone** des commandes pour
 * `initClickToSource` / l'inspecteur, maintenu à jour via `onChanged`.
 */

type Commands = RenderPickerSettings["commands"];

let commandsCache: Commands = DEFAULT_SETTINGS.commands;
const listeners = new Set<(c: Commands) => void>();

/** Merge d'un objet `commands` stocké sur les défauts (robuste aux champs manquants). */
function mergeCommands(stored: Partial<Commands> | undefined): Commands {
  const d = DEFAULT_SETTINGS.commands;
  if (!stored) return d;
  return {
    arm: stored.arm ?? d.arm,
    copy: { ...d.copy, ...stored.copy },
    copyHtml: { ...d.copyHtml, ...stored.copyHtml },
    multi: { ...d.multi, ...stored.multi },
    confirm: stored.confirm ?? d.confirm,
    cancel: stored.cancel ?? d.cancel,
    source: { ...d.source, ...stored.source },
    usage: { ...d.usage, ...stored.usage },
  };
}

/** Snapshot synchrone des commandes (pour les handlers hors React). */
export function getCommandsSync(): Commands {
  return commandsCache;
}

/** Charge l'état initial depuis chrome.storage et s'abonne aux changements. */
export async function initStorage(): Promise<{ commands: Commands }> {
  const got = await chrome.storage.sync.get("commands");
  commandsCache = mergeCommands(got.commands as Partial<Commands> | undefined);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.commands) {
      commandsCache = mergeCommands(changes.commands.newValue as Partial<Commands>);
      for (const fn of listeners) fn(commandsCache);
    }
  });

  return { commands: commandsCache };
}

export function saveCommands(commands: Commands): void {
  commandsCache = commands;
  void chrome.storage.sync.set({ commands });
}

export function onCommandsChange(fn: (c: Commands) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
