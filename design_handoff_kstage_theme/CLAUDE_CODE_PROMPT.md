# Prompt à coller dans Claude Code

> Ouvre Claude Code à la racine de ton repo KStage, place ce dossier
> `design_handoff_kstage_theme/` dedans (ou à côté), puis colle ceci :

---

Je veux appliquer une refonte de thème à cette app (Next.js + Tailwind v4 + shadcn).
Tout est décrit dans `design_handoff_kstage_theme/README.md` — lis-le en entier d'abord,
ainsi que `INTEGRATION.md`.

Le principe : **on ne change AUCUNE disposition ni structure de page**, seulement
l'habillage (couleurs, ombres, typo). Le thème a deux peaux pilotées par le `.dark`
existant : Daylight (clair) et Midnight (sombre).

Ouvre `design_handoff_kstage_theme/mockups/KStage Home.dc.html` dans un navigateur
pour voir le rendu cible (toggle ☀/☾ en haut à droite, nav des 4 écrans dans le header).

Fais les étapes du README dans l'ordre : 0. Remplace `src/app/globals.css` par celui du bundle (si pas déjà fait).

1. Ajoute les polices Space Grotesk + Instrument Serif dans `layout.tsx`.
2. Remplace toutes les couleurs en dur (#8b5cff, #ff2d87, #0e0e13) par les tokens.
3. Remplace `ring-1 ring-foreground/10` par `border border-border shadow-soft` partout
   (sauf les états actifs/sélectionnés qui gardent un ring-primary).
4. Allège les labels de section en mono (garde le mono pour heures/compteurs/dates).
5. Mets à jour `EVENT_TYPE_COLORS`.

Avant de commencer, montre-moi la liste des fichiers que tu comptes modifier et
attends ma validation. Procède ensuite fichier par fichier. Ne touche pas à la logique
métier, aux requêtes, ni à la structure JSX — uniquement les classes et styles.
