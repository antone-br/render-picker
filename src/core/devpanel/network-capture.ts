import type { NetEntry } from "./store";

/**
 * Capture les requêtes `fetch` + `XMLHttpRequest` (méthode, url, statut, durée +
 * headers / payload / réponse / initiator) via un callback. Retourne un cleanup
 * qui restaure les originaux. No-op hors navigateur.
 */

const BODY_CAP = 10000;
const STACK_CAP = 4000;

function cap(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function urlOf(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === "object" && "url" in input) {
    return String((input as { url: unknown }).url);
  }
  return String(input);
}

/** Pile d'appel (sans les 2 premières frames internes). */
function initiatorStack(): string {
  const raw = new Error().stack ?? "";
  const lines = raw.split("\n").slice(3).join("\n").trim();
  return cap(lines, STACK_CAP);
}

/** Normalise `Headers | Record | [k,v][]` → record. */
function normalizeHeaders(h: HeadersInit | undefined): Record<string, string> | undefined {
  if (!h) return undefined;
  const out: Record<string, string> = {};
  if (typeof Headers !== "undefined" && h instanceof Headers) {
    h.forEach((v, k) => (out[k] = v));
  } else if (Array.isArray(h)) {
    for (const [k, v] of h) out[k] = v;
  } else {
    Object.assign(out, h);
  }
  return Object.keys(out).length ? out : undefined;
}

function headersOf(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => (out[k] = v));
  return out;
}

/** Parse `getAllResponseHeaders()` (texte brut CRLF) → record. */
function parseRawHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function bodyToText(body: unknown): string | undefined {
  if (typeof body === "string") return cap(body, BODY_CAP);
  if (body == null) return undefined;
  return `[${Object.prototype.toString.call(body).slice(8, -1)}]`;
}

export function initNetworkCapture(onEntry: (e: NetEntry) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const cleanups: (() => void)[] = [];

  // --- fetch ---
  if (typeof window.fetch === "function") {
    const original = window.fetch;
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const start = Date.now();
      const method = (init?.method || (input as Request)?.method || "GET").toUpperCase();
      const url = urlOf(input);
      const initiator = initiatorStack();
      const reqHeaders = normalizeHeaders(init?.headers);
      const reqBody = bodyToText(init?.body);

      const base = { method, url, ts: start, initiator, reqHeaders, reqBody };

      return original.call(window, input as RequestInfo, init).then(
        (res) => {
          const meta: NetEntry = {
            ...base,
            status: res.status,
            ok: res.ok,
            durationMs: Date.now() - start,
            resHeaders: headersOf(res.headers),
            type: res.headers.get("content-type") ?? undefined,
          };
          // Lire le corps via un clone (ne consomme pas la réponse de l'app).
          res
            .clone()
            .text()
            .then(
              (text) => onEntry({ ...meta, resBody: cap(text, BODY_CAP) }),
              () => onEntry(meta),
            );
          return res;
        },
        (err) => {
          onEntry({ ...base, status: 0, ok: false, durationMs: Date.now() - start });
          throw err;
        },
      );
    }) as typeof window.fetch;
    cleanups.push(() => {
      window.fetch = original;
    });
  }

  // --- XMLHttpRequest ---
  const XHR = window.XMLHttpRequest;
  if (XHR) {
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    const setHeader = XHR.prototype.setRequestHeader;
    type Tracked = XMLHttpRequest & {
      __rp?: {
        method: string;
        url: string;
        start: number;
        reqHeaders: Record<string, string>;
        reqBody?: string;
        initiator: string;
      };
    };

    XHR.prototype.open = function (this: Tracked, method: string, url: string, ...rest: unknown[]) {
      this.__rp = {
        method: (method || "GET").toUpperCase(),
        url: urlOf(url),
        start: 0,
        reqHeaders: {},
        initiator: "",
      };
      // @ts-expect-error — passthrough de la signature native
      return open.call(this, method, url, ...rest);
    } as typeof XHR.prototype.open;

    XHR.prototype.setRequestHeader = function (this: Tracked, name: string, value: string) {
      if (this.__rp) this.__rp.reqHeaders[name] = value;
      return setHeader.call(this, name, value);
    } as typeof XHR.prototype.setRequestHeader;

    XHR.prototype.send = function (this: Tracked, ...args: unknown[]) {
      const rp = this.__rp;
      if (rp) {
        rp.start = Date.now();
        rp.reqBody = bodyToText(args[0]);
        rp.initiator = initiatorStack();
        this.addEventListener("loadend", () => {
          let resBody: string | undefined;
          try {
            resBody = typeof this.responseText === "string" ? cap(this.responseText, BODY_CAP) : undefined;
          } catch {
            resBody = undefined;
          }
          onEntry({
            method: rp.method,
            url: rp.url,
            status: this.status,
            ok: this.status >= 200 && this.status < 400,
            durationMs: Date.now() - rp.start,
            ts: rp.start,
            reqHeaders: Object.keys(rp.reqHeaders).length ? rp.reqHeaders : undefined,
            reqBody: rp.reqBody,
            resHeaders: parseRawHeaders(this.getAllResponseHeaders?.() ?? ""),
            resBody,
            type: this.getResponseHeader?.("content-type") ?? undefined,
            initiator: rp.initiator,
          });
        });
      }
      // @ts-expect-error — passthrough de la signature native
      return send.apply(this, args);
    } as typeof XHR.prototype.send;

    cleanups.push(() => {
      XHR.prototype.open = open;
      XHR.prototype.send = send;
      XHR.prototype.setRequestHeader = setHeader;
    });
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}
