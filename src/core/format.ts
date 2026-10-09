import type { PickResult } from "./types";

/**
 * Formatage du texte copié. Pur / sans React.
 */

/** Préfixe du texte copié. */
export const OUTPUT_PREFIX = "[renderPicker]";

/**
 * Lignes `Source:` (fichier:ligne) puis `React:` (composant) — React en dernier.
 * Chacune omise si absente.
 */
function reactLines(r: PickResult): string[] {
  const out: string[] = [];
  if (r.reactSource) out.push(`Source: ${r.reactSource}`);
  if (r.reactComponent) out.push(`React: ${r.reactComponent}`);
  return out;
}

/**
 * Formate un résultat — une ligne par champ (vrais retours à la ligne),
 * sans Origin/Project, `Source:` séparé et `React:` (composant) en dernier.
 */
export function formatResult(r: PickResult): string {
  return [
    OUTPUT_PREFIX,
    `Route: ${r.route}`,
    `XPath: ${r.xpath}`,
    `CSS: ${r.cssSelector}`,
    ...reactLines(r),
  ].join("\n");
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/** Attributs sérialisés dans l'ordre : ` name="value"` (quotes échappées). */
function serializeAttrs(el: Element): string {
  let out = "";
  for (const attr of Array.from(el.attributes)) {
    out += ` ${attr.name}="${attr.value.replace(/"/g, "&quot;")}"`;
  }
  return out;
}

function printNode(node: Node, depth: number, indent: string): string {
  const pad = indent.repeat(depth);
  if (node.nodeType === 3) {
    const text = (node.textContent ?? "").trim();
    return text ? pad + text : "";
  }
  if (node.nodeType === 8) {
    // Nœud commentaire — préservé (annotations « classe → CSS » de la copie reproductible).
    return `${pad}<!--${node.textContent ?? ""}-->`;
  }
  if (node.nodeType !== 1) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const open = `<${tag}${serializeAttrs(el)}>`;
  if (VOID_ELEMENTS.has(tag)) return pad + open;

  const children = Array.from(el.childNodes);
  // Élément OU commentaire → rendu multi-ligne (le commentaire passe sous la balise).
  const hasBlockChild = children.some((c) => c.nodeType === 1 || c.nodeType === 8);

  // Pas d'enfant bloc : inline (ou balise vide).
  if (!hasBlockChild) {
    const text = (el.textContent ?? "").trim();
    return text ? `${pad}${open}${text}</${tag}>` : `${pad}${open}</${tag}>`;
  }

  const lines = [pad + open];
  for (const child of children) {
    const line = printNode(child, depth + 1, indent);
    if (line) lines.push(line);
  }
  lines.push(`${pad}</${tag}>`);
  return lines.join("\n");
}

/**
 * Pretty-print d'un fragment HTML (`outerHTML`) : indentation par profondeur,
 * éléments void sans fermeture, texte simple en ligne. No-op hors navigateur.
 */
export function formatHtml(html: string, indent = "  "): string {
  if (typeof document === "undefined") return html;
  const container = document.createElement("div");
  container.innerHTML = html.trim();
  return Array.from(container.childNodes)
    .map((n) => printNode(n, 0, indent))
    .filter(Boolean)
    .join("\n");
}

/** Formate plusieurs résultats — Route partagée en tête, un bloc par élément. */
export function formatResults(results: PickResult[]): string {
  if (results.length <= 1) {
    return results[0] ? formatResult(results[0]) : OUTPUT_PREFIX;
  }
  const head = [
    `${OUTPUT_PREFIX} ${results.length} elements`,
    `Route: ${results[0]!.route}`,
  ];
  const blocks = results.map((r, i) =>
    [`#${i + 1}`, `XPath: ${r.xpath}`, `CSS: ${r.cssSelector}`, ...reactLines(r)].join(
      "\n",
    ),
  );
  return [...head, "", blocks.join("\n\n")].join("\n");
}
