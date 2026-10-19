# Types et interfaces

## `interface` vs `type`

### `interface` par défaut

Pour les props de composants, les objets de données et les contrats d'API (callbacks, options, handles retournés).

```ts
export interface PickResult { ... }          // src/core/types.ts
export interface RenderPickerOptions { ... } // src/client.ts
export interface QueryHistory {              // src/core/search/query-history.ts
  readonly current: string;
  push(query: string): void;
  undo(): boolean;
}
```

### `type` pour les cas spécifiques

Unions, alias, types dérivés (`Pick`, `Omit`, accès indexé), tuples.

```ts
type TooltipSide = "top" | "right";
type Commands = RenderPickerSettings["commands"];
```

---

## Nommage

| Type                        | Convention               | Exemple                 |
| --------------------------- | ------------------------ | ----------------------- |
| Props d'un composant        | `<Composant>Props`       | `TooltipProps`          |
| Options d'un `init*`        | `<Nom>Options`           | `RenderPickerOptions`   |
| Handle retourné (fabrique)  | nom du concept           | `QueryHistory`          |
| Callbacks                   | `<Nom>Callbacks`         | `InspectorCallbacks`    |

---

## Emplacement

- **`src/core/types.ts`** : types partagés par plusieurs modules (`PickResult`, `InspectorCallbacks`, `LayoutOverlays`, `ResolvedPosition`).
- **Dans le module** : type utilisé par un seul fichier, ou contrat propre au module (`QueryHistory` dans `query-history.ts`).
- Avant d'en créer un, vérifier par `grep` qu'il n'existe pas déjà.

---

## Documentation

Les champs des types **publics** (exportés par une entrée du package) ont un commentaire JSDoc, avec `@default` quand il y a une valeur par défaut. Ces commentaires apparaissent dans les `.d.ts` publiés.

```ts
export interface RenderPickerOptions {
  /** Active l'outillage. Défaut : `process.env.NODE_ENV !== "production"`. */
  enabled?: boolean;
}
```

---

## Strictness

- `noUncheckedIndexedAccess` est actif : un accès indexé (`arr[i]`, `map[key]`) est `T | undefined` — le gérer explicitement, pas de `!` gratuit.
- Pas de `any` sans justification en commentaire ; préférer `unknown` + narrowing.
- `readonly` sur les champs qu'un consommateur ne doit pas muter.

---

## Anti-patterns

- Mélanger `interface` et `type` sans cohérence pour des objets simples.
- Nommer des props autrement que `<Composant>Props` (les props inline `{ color: string }` sont tolérées pour les petits composants d'icônes).
- Dupliquer un type déjà présent dans `core/types.ts`.
- Champs publics sans JSDoc.
