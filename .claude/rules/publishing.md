# Publication npm

## Contenu publié

- Nom npm : `@antone-br/render-picker` (scopé). `publishConfig.access: public` obligatoire, sinon npm le publie en privé (payant).
- Le champ `files` de `package.json` limite le paquet à `dist/`, `README.md`, `LICENSE`. Le reste (tests, `.claude/`, config) ne part pas sur npm.
- Vérifier avant chaque publication : `npm pack --dry-run`.

## Métadonnées

- `author` : `Antone Barbaud <antone.barbaud@icloud.com>`. Ne jamais utiliser une adresse frame-ux.
- `repository` / `homepage` / `bugs` : `https://github.com/Antone-br/render-picker`.
- `license` : MIT. Le fichier `LICENSE` porte `Copyright (c) <année> Antone Barbaud`.

## Versions (semver)

| Changement                                     | Version |
| ---------------------------------------------- | ------- |
| Correction sans changement d'API               | patch   |
| Nouvelle option / nouvel export compatible     | minor   |
| Option renommée/supprimée, format de sortie modifié | major (minor tant qu'on est en `0.x`) |

Une version publiée est immuable : corriger = publier une nouvelle version.

## Procédure

1. `npm run typecheck && npm test && npm run build`
2. `npm pack --dry-run`
3. Monter la version (`npm version patch|minor|major`)
4. `npm publish` — **toujours demander confirmation à l'utilisateur avant** (action publique, irréversible)
5. `git push --follow-tags`

## Anti-patterns

- Publier sans confirmation explicite.
- Publier avec des tests ou un typecheck en échec.
- Mettre un secret (token npm, `.env`) dans le repo ou le paquet.
