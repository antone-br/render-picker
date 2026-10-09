/**
 * Sérialise un sous-arbre DOM en HTML **autoportant** : chaque nœud reçoit un
 * `style="…"` = styles calculés (`getComputedStyle`) filtrés aux valeurs ≠ défaut UA.
 * But : coller le snippet n'importe où et retrouver un rendu quasi identique, sans
 * dépendre des classes/CSS de la page. Pur (DOM), sans React, no-op en SSR.
 *
 * Limites : pas de pseudo-éléments (`::before/::after`), pas d'inline des assets
 * (les `url(...)` restent des références).
 */

import { IGNORE_ATTR } from "./inspector/constants/behavior";
import { formatHtml } from "./format";

/** Au-delà, on arrête de styliser (structure conservée) pour ne pas figer l'onglet. */
const MAX_NODES = 500;

/** Propriétés héritées : on ne les ré-inline pas si elles valent déjà celles du parent. */
const INHERITED = new Set<string>([
  "color",
  "cursor",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "font-stretch",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-indent",
  "text-transform",
  "text-shadow",
  "white-space",
  "word-break",
  "overflow-wrap",
  "visibility",
  "caret-color",
  "list-style",
  "list-style-type",
  "list-style-position",
  "direction",
  "-webkit-font-smoothing",
  "-webkit-text-fill-color",
  "-webkit-locale",
]);

/** Lecteur de styles par défaut (UA) via une iframe vierge. `null` si indispo. */
function createDefaultsReader(): {
  defaultsFor: (tag: string) => Map<string, string>;
  destroy: () => void;
} | null {
  const iframe = document.createElement("iframe");
  iframe.setAttribute(IGNORE_ATTR, "");
  iframe.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;left:-9999px";
  iframe.srcdoc = "<!doctype html><html><head></head><body></body></html>";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const body = doc?.body;
  const view = iframe.contentWindow;
  if (!doc || !body || !view) {
    iframe.remove();
    return null;
  }

  const cache = new Map<string, Map<string, string>>();
  return {
    defaultsFor(tag) {
      const cached = cache.get(tag);
      if (cached) return cached;
      const map = new Map<string, string>();
      try {
        const el = doc.createElement(tag);
        body.appendChild(el);
        const cs = view.getComputedStyle(el);
        for (let i = 0; i < cs.length; i++) {
          const p = cs[i]!;
          map.set(p, cs.getPropertyValue(p));
        }
        body.removeChild(el);
      } catch {
        // tag exotique — pas de défaut, tout sera considéré non-défaut
      }
      cache.set(tag, map);
      return map;
    },
    destroy() {
      iframe.remove();
    },
  };
}

/**
 * Pose sur `clone` les styles calculés de `orig` qui diffèrent du défaut UA, en
 * excluant les variables CSS (`--*`) et les propriétés héritées déjà égales au parent
 * (elles cascadent).
 */
function inlineStyles(
  orig: Element,
  clone: Element,
  parent: Element | null,
  defaultsFor: (tag: string) => Map<string, string>,
): void {
  const cs = getComputedStyle(orig);
  const def = defaultsFor(orig.tagName.toLowerCase());
  const parentCs = parent ? getComputedStyle(parent) : null;
  const decls: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    const p = cs[i]!;
    if (p.startsWith("--")) continue; // variables CSS : bruit massif, inutiles au rendu inline
    const v = cs.getPropertyValue(p);
    if (!v || v === def.get(p)) continue; // vide ou défaut UA
    // Propriété héritée identique au parent → inutile (elle cascade).
    if (INHERITED.has(p) && parentCs && parentCs.getPropertyValue(p) === v) continue;
    decls.push(`${p}: ${v}`);
  }
  if (decls.length > 0) clone.setAttribute("style", decls.join("; "));
}

/**
 * Mappe chaque classe du sous-arbre à ses déclarations CSS, lues dans les feuilles
 * de style de la page (règle `.<classe>`). Ordre de première apparition. Les feuilles
 * cross-origin (accès `.cssRules` qui lève) sont ignorées.
 */
function collectClassRules(root: Element): Map<string, string> {
  const classes: string[] = [];
  const seen = new Set<string>();
  const addClasses = (el: Element) => {
    const raw = el.getAttribute("class");
    if (raw) {
      for (const c of raw.trim().split(/\s+/)) {
        if (c && !seen.has(c)) {
          seen.add(c);
          classes.push(c);
        }
      }
    }
    for (const kid of el.children) addClasses(kid);
  };
  addClasses(root);

  const out = new Map<string, string>();
  if (classes.length === 0 || typeof document === "undefined") return out;

  const esc = (s: string) =>
    typeof CSS !== "undefined" && CSS.escape
      ? CSS.escape(s)
      : s.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);

  const wanted = new Map<string, string>(); // selectorText → classe
  for (const c of classes) wanted.set(`.${esc(c)}`, c);

  // Scanne récursivement : les règles de style vivent souvent dans des blocs
  // groupants (@layer utilities, @media, @supports) — ex. Tailwind v4.
  const scan = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      // Duck-typing (jsdom n'expose pas CSSStyleRule comme global).
      const r = rule as CSSStyleRule & { cssRules?: CSSRuleList };
      if (typeof r.selectorText === "string" && r.style) {
        const cls = wanted.get(r.selectorText);
        if (cls) {
          const decl = r.style.cssText.trim().replace(/;\s*$/, "");
          if (decl) {
            const prev = out.get(cls);
            out.set(cls, prev ? `${prev} ${decl}` : decl);
          }
        }
      } else if (r.cssRules) {
        scan(r.cssRules); // bloc groupant (@layer / @media / @supports …)
      }
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      scan(sheet.cssRules);
    } catch {
      continue; // feuille cross-origin
    }
  }

  // Réordonner selon l'apparition des classes.
  const ordered = new Map<string, string>();
  for (const c of classes) {
    const d = out.get(c);
    if (d) ordered.set(c, d);
  }
  return ordered;
}

/**
 * Résout les variables CSS (`var(--x)`) référencées dans des déclarations, à leur
 * valeur effective au niveau de `root` (toute la cascade). Transitif (une valeur peut
 * elle-même contenir des `var()`). Ignore les variables non définies (valeur vide).
 */
function collectVarDefs(declarations: Iterable<string>, root: Element): Map<string, string> {
  const defs = new Map<string, string>();
  if (typeof getComputedStyle === "undefined") return defs;
  const rootCs = getComputedStyle(root);

  const namesIn = (text: string): string[] => {
    const found: string[] = [];
    const re = /var\(\s*(--[A-Za-z0-9_-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) found.push(m[1]!);
    return found;
  };

  const queue: string[] = [];
  for (const decl of declarations) queue.push(...namesIn(decl));

  const seen = new Set<string>();
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const val = rootCs.getPropertyValue(name).trim();
    if (!val) continue; // variable non définie
    defs.set(name, val);
    queue.push(...namesIn(val)); // transitif
  }
  return defs;
}

export function serializeWithComputedStyles(root: Element): string {
  if (typeof window === "undefined" || typeof getComputedStyle === "undefined") {
    return formatHtml(root.outerHTML);
  }

  const reader = createDefaultsReader();
  if (!reader) return formatHtml(root.outerHTML);

  try {
    // Map classe → CSS (règles de la page), pour annoter chaque élément.
    const classToCss = collectClassRules(root);

    // Nombre de balises distinctes utilisant chaque classe (pour séparer propre vs global).
    const usage = new Map<string, number>();
    const countWalk = (el: Element) => {
      const raw = el.getAttribute("class");
      if (raw) {
        for (const cls of new Set(raw.trim().split(/\s+/))) {
          usage.set(cls, (usage.get(cls) ?? 0) + 1);
        }
      }
      for (const kid of el.children) countWalk(kid);
    };
    countWalk(root);

    const clone = root.cloneNode(true) as Element;
    let count = 0;
    let truncated = 0;

    // Parcours parallèle orig ↔ clone. `parent` = parent DANS le sous-arbre (null pour
    // la racine → ses propriétés héritées sont inlinées pour rester autoportant).
    const walk = (o: Element, c: Element, parent: Element | null): void => {
      if (count >= MAX_NODES) {
        truncated++;
        return;
      }
      count++;
      inlineStyles(o, c, parent, reader.defaultsFor);

      // Commentaire sous la balise (1er enfant) : CSS des classes PROPRES à CET élément
      // (utilisées une seule fois). Les classes partagées vont dans le bloc global.
      const raw = o.getAttribute("class");
      if (raw) {
        const parts: string[] = [];
        for (const cls of raw.trim().split(/\s+/)) {
          const decl = classToCss.get(cls);
          if (decl && usage.get(cls) === 1) parts.push(`.${cls} { ${decl} }`);
        }
        if (parts.length > 0) {
          const comment = c.ownerDocument.createComment(` ${parts.join(" ")} `);
          c.insertBefore(comment, c.firstChild);
        }
      }

      // `.children` ne compte que les éléments (le commentaire inséré n'y figure pas)
      // → indices orig ↔ clone restent alignés.
      const oKids = o.children;
      const cKids = c.children;
      for (let i = 0; i < oKids.length; i++) {
        const ok = oKids[i];
        const ck = cKids[i];
        if (ok && ck) walk(ok, ck, o);
      }
    };
    walk(root, clone, null);

    if (truncated > 0) {
      console.warn(
        `[render-picker] copie reproductible : ${truncated} nœud(s) au-delà de ${MAX_NODES} non stylisés.`,
      );
    }

    const html = formatHtml(clone.outerHTML);

    // Bloc final : classes utilisées sur PLUSIEURS balises (ordre d'apparition).
    const globalLines: string[] = [];
    for (const [cls, decl] of classToCss) {
      if ((usage.get(cls) ?? 0) >= 2) globalLines.push(`  .${cls} { ${decl} }`);
    }
    let out = html;
    if (globalLines.length > 0) {
      out += `\n\n<!-- Classes globales (utilisées sur plusieurs balises)\n${globalLines.join("\n")}\n-->`;
    }

    // Bloc final : valeurs des variables CSS (var(--x)) référencées dans les classes.
    const defs = collectVarDefs(classToCss.values(), root);
    if (defs.size > 0) {
      const varLines = Array.from(defs, ([name, val]) => `  ${name}: ${val}`);
      out += `\n\n<!-- Variables CSS\n${varLines.join("\n")}\n-->`;
    }
    return out;
  } finally {
    reader.destroy();
  }
}
