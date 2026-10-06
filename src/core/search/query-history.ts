/**
 * Historique de requêtes de l'input de recherche (undo/redo maison) : l'input
 * contrôlé + les changements programmatiques (clic suggestion, flèches) ne
 * remontent pas via l'undo natif du navigateur. Sans React, sans DOM.
 */

const MAX_HISTORY = 100;

export interface QueryHistory {
  /** Valeur courante de l'historique (sans effet de bord). */
  readonly current: string;
  /** Pousse une nouvelle requête (no-op si identique à la courante), tronque le redo à venir. */
  push(query: string): void;
  /** Recule d'un cran (`false` si déjà au premier). */
  undo(): boolean;
  /** Avance d'un cran (`false` si déjà au dernier). */
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function makeQueryHistory(initial = ""): QueryHistory {
  let stack: string[] = [initial];
  let cursor = 0;

  const round = (v: number): number => Math.max(0, Math.min(stack.length - 1, v));

  return {
    get current() {
      return stack[cursor]!;
    },
    push(query) {
      if (query === stack[cursor]) return;
      stack = stack.slice(0, cursor + 1);
      stack.push(query);
      if (stack.length > MAX_HISTORY) {
        stack = stack.slice(stack.length - MAX_HISTORY);
      }
      cursor = stack.length - 1;
    },
    undo() {
      if (cursor === 0) return false;
      cursor = round(cursor - 1);
      return true;
    },
    redo() {
      if (cursor >= stack.length - 1) return false;
      cursor = round(cursor + 1);
      return true;
    },
    canUndo() {
      return cursor > 0;
    },
    canRedo() {
      return cursor < stack.length - 1;
    },
  };
}
