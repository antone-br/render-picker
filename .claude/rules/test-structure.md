# Structure des tests — miroir de `src/core/`

> `tests/` reproduit l'arborescence de `src/core/`. Les entrées du package et les modules
> à la racine du core sont testés à la racine de `tests/`. Un `index.md` par dossier.

---

## Arborescence

```
tests/
  index.md                    ← racine + renvoi vers les sous-dossiers
  client.test.ts              ← src/client.ts
  next.test.ts                ← src/next.ts
  react.test.tsx              ← src/react.tsx + src/ui/* + src/core/format.ts
  settings.test.ts            ← src/core/settings.ts
  computed-html.test.ts       ← src/core/computed-html.ts
  inspector/                  ← src/core/inspector/
    index.md
    surfaces/                 ← src/core/inspector/surfaces/
      index.md
  source/                     ← src/core/source/
  search/                     ← src/core/search/
  devpanel/                   ← src/core/devpanel/
  dev/                        ← src/core/dev/
  server/                     ← src/server/ (Node : route dev)
```

---

## Règles

1. **Dossier de tests = dossier de `src/core/`**, même nom (`src/core/search/` → `tests/search/`). On ne recrée pas le segment `core/`. Exception : `src/server/` → `tests/server/`.
2. **Racine de `tests/`** : entrées du package (`client`, `next`, `react`) et modules à la racine de `src/core/` (`settings`, `computed-html`, `format`).
3. **Composants et hooks React** (`src/ui/**`) : testés via `tests/react.test.tsx` (rendu de `RenderPickerButton` et des widgets). Si un widget grossit au point de mériter son propre fichier, créer `tests/ui/<widget>.test.tsx` en miroir de `src/ui/`, avec son `index.md`.
4. **Fichier de test = nom du module** + `.test.ts` / `.test.tsx`.
5. **Pas de dossier sans correspondance** dans `src/` ; pas de dossier vide.
6. **Fixtures** : déclarées dans le fichier de test. Si plusieurs fichiers d'un dossier les partagent, un `helpers.ts` unique à la racine de ce dossier — pas de dossier `fixtures/`.
7. **Extension** (`extension/`) : pas de tests dédiés ; sa logique réutilise le core, testé ici. Logique propre à l'extension non triviale (ex. `storage.ts`) ⇒ l'extraire ou ajouter `tests/extension/`.

---

## `index.md` — un par dossier

Chaque dossier de tests a **son** `index.md`, mis à jour à **chaque** ajout, suppression ou changement de portée d'un test.

Format :

```markdown
# Tests — `search/` ↔ `src/core/search/`

> Une ligne sur le périmètre du dossier.

| Fichier                   | Module testé                          | Couvre                                     |
| ------------------------- | ------------------------------------- | ------------------------------------------ |
| `query-history.test.ts`   | `src/core/search/query-history.ts`    | push, undo/redo, troncature du redo, max.  |
```

- La colonne **Couvre** liste les comportements testés (pas un simple « tests de X »).
- `tests/index.md` (racine) contient sa propre table + la table des sous-dossiers avec liens vers leurs `index.md`. Nouveau sous-dossier ⇒ ajouter sa ligne.

---

## Anti-patterns

- ❌ Test posé à la racine alors que son module vit dans un sous-dossier de `src/core/` (ou l'inverse).
- ❌ Dossier `tests/core/…` (le segment `core/` n'est pas reproduit).
- ❌ Dossier de tests sans `index.md`, ou `index.md` non mis à jour.
- ❌ Mêmes cas testés à deux endroits.
- ❌ Dossier `fixtures/` / `shared/` / `common/` séparé.
