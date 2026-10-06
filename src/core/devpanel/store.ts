/**
 * Buffers en mémoire du panneau d'inspection (console + network). Ring bornés,
 * abonnement pour l'UI. Module singleton, sans React, sans effet à l'import.
 */

export interface LogEntry {
  level: "log" | "info" | "warn" | "error" | "debug";
  text: string;
  ts: number;
}

export interface NetEntry {
  method: string;
  url: string;
  status: number;
  ok: boolean;
  durationMs: number;
  ts: number;
  /** Détails (dépliables dans l'UI). */
  reqHeaders?: Record<string, string>;
  resHeaders?: Record<string, string>;
  reqBody?: string;
  resBody?: string;
  type?: string;
  initiator?: string;
}

const MAX = 500;

const logs: LogEntry[] = [];
const requests: NetEntry[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function addLog(entry: LogEntry): void {
  logs.push(entry);
  if (logs.length > MAX) logs.shift();
  emit();
}

export function addRequest(entry: NetEntry): void {
  requests.push(entry);
  if (requests.length > MAX) requests.shift();
  emit();
}

export function getState(): { logs: LogEntry[]; requests: NetEntry[] } {
  return { logs, requests };
}

export function clearLogs(): void {
  logs.length = 0;
  emit();
}

export function clearRequests(): void {
  requests.length = 0;
  emit();
}

/** S'abonne aux changements. Retourne une fonction de désabonnement. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
