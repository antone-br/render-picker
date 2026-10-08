/**
 * Élément actuellement survolé/pické par l'inspecteur, partagé avec l'arbre HTML
 * du panneau (pour « révéler » le nœud comme DevTools). Singleton, sans React,
 * sans effet à l'import.
 */

let current: Element | null = null;
const listeners = new Set<(el: Element | null) => void>();

/** Définit l'élément inspecté et notifie les abonnés. */
export function setInspected(el: Element | null): void {
  current = el;
  for (const fn of listeners) fn(el);
}

/** Dernier élément inspecté (ou `null`). */
export function getInspected(): Element | null {
  return current;
}

/** S'abonne aux changements. Retourne une fonction de désabonnement. */
export function subscribeInspected(fn: (el: Element | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Mode « sélection dans l'arbre » : actif tant que l'onglet HTML est monté. Quand il
// est actif, un clic sur un élément de la page le sélectionne dans l'arbre (au lieu de
// le copier via le pick normal).
let treeSelectMode = false;

export function setTreeSelectMode(on: boolean): void {
  treeSelectMode = on;
}

export function isTreeSelectMode(): boolean {
  return treeSelectMode;
}

const selectListeners = new Set<(el: Element) => void>();

/** Demande de sélectionner un élément dans l'arbre (clic page en mode HTML). */
export function requestSelect(el: Element): void {
  for (const fn of selectListeners) fn(el);
}

/** S'abonne aux demandes de sélection. Retourne une fonction de désabonnement. */
export function onSelectRequest(fn: (el: Element) => void): () => void {
  selectListeners.add(fn);
  return () => selectListeners.delete(fn);
}

const disarmListeners = new Set<() => void>();

/** Demande de désarmer le picker (ex. clic sur une ligne de l'arbre HTML → fige la sélection). */
export function requestDisarm(): void {
  for (const fn of disarmListeners) fn();
}

/** S'abonne aux demandes de désarmement. Retourne une fonction de désabonnement. */
export function onDisarmRequest(fn: () => void): () => void {
  disarmListeners.add(fn);
  return () => disarmListeners.delete(fn);
}
