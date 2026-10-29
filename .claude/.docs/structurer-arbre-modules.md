# Bien structurer l'arbre de modules

> Guide pratique pour que "Copier l'arbre des modules" (menu contextuel de l'overlay
> modules PrestaShop) produise un arbre lisible et correct. Détails d'implémentation :
> voir `architecture.md` → section "Menu Modules".

## Le principe

L'arbre n'est pas lu dans le DOM ni dans Smarty : il est reconstruit en comparant les
**rectangles** (position + taille) de chaque module à l'écran. Un module A devient parent
d'un module B si le rectangle de A contient entièrement celui de B. Le parent retenu est
le plus **petit** rectangle englobant (le confinement le plus serré), pas le plus grand.

Conséquence directe : **la structure visuelle = la structure de l'arbre**. Pas de
configuration à faire côté render-picker — tout se joue dans la façon dont le thème/les
templates empilent leurs conteneurs.

## Pour que des modules apparaissent nestés

Il faut un **wrapper réel** autour d'eux dans le HTML rendu, dont le rectangle les
contient tous. Exemple (footer avec plusieurs blocs dans une même colonne) :

```smarty
{* ✅ les 3 hooks sont dans un conteneur commun -> nestés sous lui dans l'arbre *}
<div class="footer-column">
  {hook h='displayFooterCol1a'}
  {hook h='displayFooterCol1b'}
  {hook h='displayFooterCol1c'}
</div>
```

```markdown
- footer-column
  - ps_contactinfo
  - blockreassurance
  - ps_customeraccountlinks
```

Sans ce wrapper (les 3 hooks à plat, directement dans la grille du footer), ils
ressortent comme **3 racines indépendantes** — pas faux, juste moins lisible si on
voulait les voir groupés visuellement.

## Pourquoi un module peut rester "racine" alors qu'il semble imbriqué visuellement

- **Pas de conteneur réel entre les deux** : une simple proximité CSS (grid/flex sans
  wrapper DOM dédié) ne crée aucun rectangle englobant → pas de parent détecté.
- **Rectangle de largeur ou hauteur 0** : un module vide (placeholder WOW.js inutilisé,
  variante responsive masquée) n'a pas de rectangle exploitable — ignoré par le scan
  (`unionRect`, voir `architecture.md`), donc absent de l'arbre, pas juste orphelin.
- **Rectangles strictement identiques** : si deux modules occupent exactement le même
  espace (un seul remplace l'autre selon condition d'affichage), aucun n'est désigné
  parent de l'autre — anti-boucle volontaire (`buildModuleTree`). Normal, pas un bug.
- **Remontée au wrapper exclusif du thème** (`climbExclusiveWrapper`) : le rectangle d'un
  module peut déjà inclure un conteneur thème parent (`#contact_info_sag` autour de
  `ps_contactinfo`, par ex.) — ça joue sur la taille du rectangle AVANT même le calcul de
  l'arbre, donc ça peut faire apparaître un module comme englobant un voisin qu'il n'est
  pas censé "contenir" logiquement. Si l'arbre semble faux, vérifier d'abord la taille
  réelle du rectangle (survol de l'overlay) avant de soupçonner l'algo de nesting.

## Bonnes pratiques pour un arbre propre

1. **Grouper par wrapper sémantique**, pas par accident de layout. Un `<div class="col">`
   qui enveloppe plusieurs hooks liés (ex. tout le bloc "contact" du footer) donne un
   arbre qui reflète l'intention, pas juste la grille CSS.
2. **Éviter les wrappers inutiles autour d'un seul module** — ça n'ajoute rien à l'arbre
   (un parent avec un seul enfant reste un parent avec un seul enfant) mais alourdit le
   HTML. Wrapper seulement quand on groupe réellement ≥ 2 modules.
3. **Ne pas chercher à forcer un nesting artificiel** avec un `<div>` invisible qui
   engloberait des modules sans rapport fonctionnel — l'arbre doit rester une lecture
   honnête de la page, pas un classement arbitraire.
4. **Modules conditionnels (affichage selon config/langue/variante)** : si deux variantes
   ne s'affichent jamais en même temps, leur chevauchement de rectangle (cas "identiques")
   est géré proprement (aucun parent croisé) — rien à faire de spécifique.

## Lire le résultat

```markdown
# Modules — /

- ps_mainmenu
- footer-column
  - ps_contactinfo
  - blockreassurance
- ps_customeraccountlinks
```

`ps_customeraccountlinks` racine malgré sa position visuelle proche du footer : signe
qu'il n'est PAS dans le même wrapper DOM que `footer-column` — information utile en soi
(ça confirme la structure réelle du thème, pas une anomalie à corriger).
