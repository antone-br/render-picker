/** Applique des styles inline à un élément. */
export function assign(el: HTMLElement, style: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, style);
}
