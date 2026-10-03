# render-picker — extension Chrome (MV3)

Version extension du picker : marche sur n'importe quelle app **Next.js lancée en dev local**,
sans l'installer dans le projet. Réutilise le moteur maison de `../src`.

## Fonctions

- Survol → overlay + tooltip (**classes CSS** de l'élément) ; clic → copie **route + XPath + CSS + composant React + `fichier:ligne`**.
- Clic droit → copie l'**HTML brut** (`outerHTML`).
- Maj+clic → sélection multiple, Entrée valide.
- Barre de paramètres : commandes remappables (persistées via `chrome.storage.sync`).
- `Maj Maj` ou l'**icône de la barre d'outils** arme/désarme le picker.
- Pas d'ouverture VS Code dans l'extension (feature réservée au package npm).

## Installation (dev, non empaquetée)

```bash
npm run ext:build          # → extension/dist/
# ou en watch : npm run ext:watch
```

1. `chrome://extensions` → activer **Mode développeur**.
2. **Charger l'extension non empaquetée** → sélectionner `extension/dist/`.
3. (Optionnel) **page d'options** → régler les commandes par défaut.

## Structure des sources

```
src/
  entries/          points d'entrée des bundles (1 fichier = 1 sortie, câblage mince)
    content.tsx     orchestration : inject MAIN world, storage, montage UI, messaging
    main-world.ts   annotation fibers (injecté en MAIN world)
    options.tsx     monte <OptionsPage/>
    background.ts   service worker : icône → toggle
  ui/
    root.tsx        ExtensionRoot (bouton + barre + inspecteur via useRenderPicker)
    options-page.tsx OptionsPage (commandes par défaut)
  storage.ts        adapteur chrome.storage (snapshot sync des commandes)
```

## Architecture

- **MAIN world** (`main-world.js`, injecté dans la page) : lit les fibers React (`_debugStack`) +
  sourcemaps des chunks → pose `data-component` / `data-source` / `data-owner-source`.
- **Content script** (`content.js`, monde isolé) : monte l'UI (shadow root), pilote l'inspecteur,
  lit les **attributs DOM** posés par le MAIN world (partagés entre les mondes), gère clipboard et
  `chrome.storage`.
- **Background** (`background.js`) : clic sur l'icône → message `toggle` au content script (injecte
  le content script à la demande si absent).

## Désactivation auto

Si l'app utilise déjà le **package npm** `@antone-br/render-picker` (il pose `data-render-picker`
sur `<html>`), l'extension **reste inactive** — pas de double picker. Si le package s'initialise
après le chargement, l'extension se démonte dès l'apparition du marqueur.

## Limites

- **Composant React + source** : seulement sur un **build dev Next avec sourcemaps**
  (`/_next/static/chunks/*._.js`). Sur du prod minifié → picker générique (route/xpath/css/html).
- `matches` limité à `localhost` / `127.0.0.1` (modifiable dans `manifest.json`).
- La CSP de certains sites peut bloquer le script injecté (localhost dev → OK).
- Icônes `dist/icons/*.png` = placeholders (à remplacer par un vrai logo).
