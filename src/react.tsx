import { useCallback, useEffect, useRef, type FC } from "react";
import {
  PathPickerButton,
  formatResult as basePathFormatResult,
  formatResults as basePathFormatResults,
  type PathPickerButtonProps,
  type PathPickerResult,
} from "react-path-picker";

import { enrichResult } from "./core/enrich";

export type RenderPickerButtonProps = PathPickerButtonProps;

/** Préfixe du texte copié (remplace `[xPathInfo]` de react-path-picker). */
export const OUTPUT_PREFIX = "[renderPicker]";
const UPSTREAM_PREFIX = /^\[xPathInfo\]/;
const UPSTREAM_TITLE = /^xPathInfo:/;

/** Formate un résultat — même format que react-path-picker, préfixe `[renderPicker]`. */
export function formatResult(r: PathPickerResult): string {
  return basePathFormatResult(r).replace(UPSTREAM_PREFIX, OUTPUT_PREFIX);
}

/** Formate plusieurs résultats (en-tête partagé), préfixe `[renderPicker]`. */
export function formatResults(results: PathPickerResult[]): string {
  return basePathFormatResults(results).replace(UPSTREAM_PREFIX, OUTPUT_PREFIX);
}

function copy(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {});
}

/**
 * `PathPickerButton` (react-path-picker) dont la sortie est complétée par le
 * `fichier:ligne` résolu par l'annotator render-picker (`data-source`).
 * Sans handler custom : copie dans le presse-papiers, comme l'original.
 */
export const RenderPickerButton: FC<RenderPickerButtonProps> = ({
  onPick,
  onPickMany,
  ...props
}) => {
  const wrapperRef = useRef<HTMLSpanElement>(null);

  // Le title du bouton est figé dans react-path-picker. Sa valeur ne change
  // qu'avec `hotkey`, donc React ne réécrit pas l'attribut entre deux rendus.
  useEffect(() => {
    const toggle = wrapperRef.current?.querySelector("[data-pathpicker-toggle]");
    const title = toggle?.getAttribute("title");
    if (toggle && title) {
      toggle.setAttribute("title", title.replace(UPSTREAM_TITLE, "renderPicker:"));
    }
  }, [props.hotkey]);

  const handlePick = useCallback(
    (result: PathPickerResult) => {
      const enriched = enrichResult(result);
      const text = formatResult(enriched);
      if (onPick) onPick(enriched, text);
      else copy(text);
    },
    [onPick],
  );

  const handlePickMany = useCallback(
    (results: PathPickerResult[]) => {
      const enriched = results.map((r) => enrichResult(r));
      const text = formatResults(enriched);
      if (onPickMany) onPickMany(enriched, text);
      else copy(text);
    },
    [onPickMany],
  );

  return (
    <span ref={wrapperRef} style={{ display: "contents" }}>
      <PathPickerButton
        {...props}
        onPick={handlePick}
        onPickMany={handlePickMany}
      />
    </span>
  );
};

export {
  PathPickerButton,
  usePathPicker,
  type PathPickerButtonProps,
  type PathPickerResult,
} from "react-path-picker";
