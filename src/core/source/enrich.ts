import type { PickResult } from "../types";

/**
 * Sous React 19, `_debugSource` n'existe plus → l'inspecteur ne résout pas
 * `reactSource`. On complète depuis les attributs `data-source` / `data-component`
 * posés par l'annotator (résolution sourcemap).
 */

/** Retrouve l'élément pické à partir de son XPath, sinon de son sélecteur CSS. */
export function findPickedElement(
  result: Pick<PickResult, "xpath" | "cssSelector">,
  doc: Document = document,
): Element | null {
  if (result.xpath) {
    try {
      const node = doc.evaluate(
        result.xpath,
        doc,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      ).singleNodeValue;
      if (node instanceof Element) return node;
    } catch {
      // XPath invalide → fallback CSS
    }
  }
  if (result.cssSelector) {
    try {
      return doc.querySelector(result.cssSelector);
    } catch {
      return null;
    }
  }
  return null;
}

export function enrichResult<T extends PickResult>(
  result: T,
  doc: Document = document,
): T {
  if (result.reactSource && result.reactComponent) return result;

  const el = findPickedElement(result, doc);
  const annotated = el?.closest("[data-source]");
  const source = annotated?.getAttribute("data-source") ?? null;
  const component =
    el?.closest("[data-component]")?.getAttribute("data-component") ?? null;

  return {
    ...result,
    reactSource: result.reactSource ?? source,
    reactComponent: result.reactComponent ?? component,
  };
}
