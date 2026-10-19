# Tests

> Vitest + jsdom. Conventions d'écriture, mocks, quand écrire quoi.
> Emplacement des fichiers : `.claude/rules/test-structure.md`.

---

## Stack

- **Vitest** (`vitest.config.ts`) : `environment: "jsdom"`, `include: ["tests/**/*.test.{ts,tsx}"]`.
- Pas de Testing Library : les composants se testent avec `createRoot` (`react-dom/client`) + `act`, et des requêtes DOM natives (`querySelector`, `dispatchEvent`).
- Imports explicites depuis `vitest` (`describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`) — pas de globals.

```bash
npm test                          # toute la suite
npx vitest run tests/inspector    # un dossier
npx vitest run tests/xpath        # filtre par nom
npm run test:watch
```

---

## Règles générales

1. **Un fichier de test par module** de `src/`, au même nom (`xpath.ts` → `xpath.test.ts`).
2. **Toute nouvelle logique ou interaction a un test du cas nominal**, plus les cas limites qui ont motivé le code (fix de bug ⇒ test de non-régression).
3. **Libellés en français**, décrivant le comportement : `it("retrouve l'élément par XPath", …)`.
4. **Cleanup vérifié** : pour chaque `init*` / `create*`, tester que le `dispose` retire listeners, observers et patchs (console restaurée, etc.).
5. **Comportement prod** : tester le no-op quand `NODE_ENV === "production"` pour tout ce qui est dev-only.
6. **DOM réinitialisé** à chaque test (`beforeEach(() => { document.body.innerHTML = … })`), pas d'état partagé entre tests.
7. Tester le **core sans React** ; ne passer par un rendu React que pour ce qui est réellement UI.

---

## Mocks courants

jsdom ne fait pas de layout ni de cascade CSS : on stubbe ce dont le code a besoin, et on restaure.

| Besoin                          | Technique                                                         |
| ------------------------------- | ----------------------------------------------------------------- |
| Styles calculés                 | `vi.stubGlobal("getComputedStyle", fake)`                         |
| Hit-test                        | stub de `document.elementFromPoint`                               |
| Géométrie                       | stub de `getBoundingClientRect` sur l'élément                     |
| Presse-papiers                  | `vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } })` ou `Object.defineProperty` |
| Environnement                   | `vi.stubEnv("NODE_ENV", "production")`                            |
| Timers (double-tap, délais)     | `vi.useFakeTimers()` + `vi.advanceTimersByTime(ms)`               |
| `localStorage`                  | jsdom le fournit : `localStorage.clear()` en `beforeEach`         |

Restauration systématique :

```ts
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
```

---

## Exemple

```ts
import { describe, expect, it } from "vitest";

import { makeQueryHistory } from "../../src/core/search/query-history";

describe("makeQueryHistory", () => {
  it("valeur initiale + push", () => {
    const h = makeQueryHistory("div");
    h.push("div.card");
    expect(h.current).toBe("div.card");
    expect(h.canUndo()).toBe(true);
  });
});
```

---

## Après chaque ajout / modification

- Mettre à jour l'`index.md` du dossier de tests (voir `.claude/rules/test-structure.md`).
- `npm run typecheck` : les tests sont inclus dans `tsconfig.json`.

---

## Anti-patterns

- Nouvelle fonctionnalité sans test.
- Mock / stub global non restauré (fuite entre fichiers).
- Test qui dépend de l'ordre d'exécution ou d'un DOM laissé par un autre test.
- Tester un détail d'implémentation (structure interne) plutôt que le comportement observable (DOM produit, valeur retournée, callback appelé).
- `it.only` / `describe.only` commités.
