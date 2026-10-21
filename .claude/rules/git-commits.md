# Git — commits

## Règle absolue

**Ne JAMAIS créer de commit (`git commit`) sans que l'utilisateur le demande explicitement.**

- Édits, tests, builds : oui. Commit : seulement sur demande claire ("commit", "commit puis publish", etc.).
- Ne jamais regrouper implicitement un commit avec une autre action (publish, push, release).
- Ne jamais `git push` sans demande explicite.
- `npm version` (bump de version + commit + tag automatiques) vaut création de commit → interdit sans demande explicite ; préférer laisser l'utilisateur lancer `release:*`.

## En cas de doute

S'arrêter avant l'étape git et demander.
