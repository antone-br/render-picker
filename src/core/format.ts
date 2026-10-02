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
