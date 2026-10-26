/**
 * Résolution de la racine projet pour le build standalone (pages sans bundler).
 * Pur (pas de globals implicites) → testable. Priorité :
 * 1. `localStorage.renderPickerRoot` — override hôte (ex. site en Docker : le serveur
 *    expose le chemin CONTENEUR `/var/www/html`, mais l'éditeur tourne sur l'hôte →
 *    poser ici le chemin local `C:/Users/.../public_html`) ;
 * 2. `window.renderPickerRoot` (`Media::addJsDef` du module PrestaShop) ;
 * 3. `<meta name="render-picker-root">`.
 */

export const ROOT_LS_KEY = "renderPickerRoot";

export type RootSource = "localStorage" | "jsDef" | "meta" | "none";

export function resolveProjectRoot(
  win: Window,
  doc: Document,
): { root: string | undefined; source: RootSource } {
  try {
    const ls = win.localStorage.getItem(ROOT_LS_KEY);
    if (ls) return { root: ls, source: "localStorage" };
  } catch {
    // localStorage inaccessible → on continue
  }
  const fromGlobal = (win as unknown as { renderPickerRoot?: string }).renderPickerRoot;
  if (fromGlobal) return { root: fromGlobal, source: "jsDef" };
  const content = doc
    .querySelector('meta[name="render-picker-root"]')
    ?.getAttribute("content");
  if (content) return { root: content, source: "meta" };
  return { root: undefined, source: "none" };
}
