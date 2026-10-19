# Hooks React

## Emplacement

Au plus près de l'usage :

- `src/ui/` : hooks partagés par plusieurs widgets (`use-render-picker.ts`, `use-outside-close.ts`).
- `src/ui/<widget>/` : hook propre à un widget (`ui/dev-panel/use-drag-resize.ts`).

Un hook public est réexporté par l'entrée `src/react.tsx` (ex. `useRenderPicker`).

La logique **non React** d'un hook (état pur, calculs, DOM impératif) descend dans `src/core/` pour être testable sans rendu (ex. `core/search/query-history.ts`).

---

## Pas de `"use client"` par fichier

La directive est ajoutée par le **banner tsup** sur les entrées navigateur (`tsup.config.ts`). Ne pas l'écrire dans les fichiers source.

---

## Nommage

`use-<nom>.ts`, nom court qui décrit ce que fait le hook, sans répéter le dossier. Voir `.claude/rules/file-naming.md`.

---

## Quand créer un hook

- Logique réutilisée par plusieurs composants (`useOutsideClose` : search + settings-menu).
- Logique assez lourde (plusieurs `useState` / `useEffect` / listeners) pour alourdir un composant (`useDragResize`).

Pas de hook pour une seule ligne de `useState` non réutilisée.

---

## `useEffect`

- Limité au strict nécessaire : dériver avec `useMemo` ou un calcul direct plutôt qu'un effet.
- **Cleanup obligatoire** : tout listener, observer, timer ou abonnement (`subscribe` du store devpanel) posé dans un effet est retiré au cleanup.
- Dépendances exhaustives. Pour un callback qui change à chaque rendu sans devoir relancer l'effet, utiliser le **pattern ref** :

```ts
export function useOutsideClose(attr: string, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onDown = (e: Event) => {
      const inside = e.composedPath().some((n) => n instanceof Element && n.hasAttribute(attr));
      if (!inside) onCloseRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [attr]);
}
```

## `useCallback` / `useMemo`

Seulement avec un bénéfice réel (référence stable passée à un enfant ou à une dépendance d'effet, calcul coûteux comme un parcours DOM). Pas d'enrobage systématique.

---

## Retour

- Objet nommé dès 2+ valeurs hétérogènes (`return { pos, width, height, beginResize, onHeaderPointerDown }` dans `use-drag-resize.ts`).
- Tuple seulement pour le pattern `[value, setValue]`.
- `void` pour un hook à effet pur (`useOutsideClose`).

---

## Anti-patterns

- Écrire `"use client"` dans un fichier source.
- Listener / observer / timer sans cleanup.
- `useEffect` pour dériver un état calculable.
- Garder dans un hook de la logique pure qui pourrait vivre (et être testée) dans `src/core/`.
- Retourner un tableau de plus de deux valeurs.
