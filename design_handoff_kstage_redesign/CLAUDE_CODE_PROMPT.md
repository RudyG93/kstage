# Prompt pour Claude Code — refonte KStage « Data Desk »

> Colle ce prompt dans Claude Code, lancé à la racine du repo KStage (le dossier `design_handoff_kstage_redesign/` doit être présent à la racine).

---

Je veux implémenter la refonte visuelle « Data Desk » de KStage. Tout le nécessaire est dans `design_handoff_kstage_redesign/` :

1. **Lis d'abord entièrement** `design_handoff_kstage_redesign/README.md` — c'est la source de vérité (tokens, typo, nav, specs des 9 écrans, interactions, critères de fin).
2. La cible visuelle est `design_handoff_kstage_redesign/mockups/KStage Prototype — Round 2.dc.html` (à ouvrir dans un navigateur pour référence — c'est un prototype HTML, **pas du code à copier** ; le cadre iPhone fait partie du mockup).

## Règles

- On recrée le design dans le codebase existant : Next.js 16 App Router, Tailwind v4, Base UI (`render`, pas `asChild`), lucide-react, next-themes. Pas de nouvelle dépendance, pas de lib de motion.
- **Tokens uniquement** : aucun hex en dur dans les `.tsx` (exceptions : `EVENT_TYPE_COLORS` dans `src/lib/events/labels.ts`, gradients de fallback dérivés de `color_hex` des groupes).
- Les deux thèmes (Daylight `:root` / Midnight `.dark`) doivent fonctionner sur chaque écran modifié — vérifier avec le `ThemeToggle` existant.
- Ne pas régresser l'accessibilité (lint `jsx-a11y`, focus states, hit targets ≥44px, `prefers-reduced-motion` pour le ticker).
- Mobile-first (~375-428px) ; le desktop garde le layout 3 colonnes existant avec les nouveaux styles.
- Conserver toute la logique data/serveur existante — c'est un re-skin + réorganisation d'interface, pas une réécriture.

## Étapes (dans cet ordre, commit par étape)

0. **Tokens** : remplacer `src/app/globals.css` par `design_handoff_kstage_redesign/globals.css`. Relancer le dev server (Tailwind v4 ne recharge pas toujours les tokens à chaud).
1. **Fonts** : dans `src/app/layout.tsx`, ajouter `Archivo` (variable, `axes: ['wdth']`, var `--font-archivo`) ; garder Geist/Geist Mono/Bricolage/Space Grotesk/Instrument Serif. `viewport.themeColor` → `#0B0D12`.
2. **Couleurs d'event** : mettre à jour `EVENT_TYPE_COLORS` (valeurs en §4 du README).
3. **Nav** : refondre `SiteNav` — bottom-nav mobile 5 items (HOME, CALENDAR, SEARCH central en FAB, DROPS, GROUPS), labels Archivo condensé, profil via l'avatar du header. Renommer « Upcoming » → « Home ».
4. **Labels de section** : remplacer le pattern `font-mono uppercase tracking-[0.18em]` par le pattern condensé (§5 du README) partout.
5. **Home** (`/` + `src/components/home/*`) : les 8 modules de §7.1 — header + recherche, ticker (nouveau), hero NEXT UP (refonte `NextDropCard`), queue dense, week glance (nouveau), fresh drops grid, community strip, footer statut.
6. **Calendar** : grille cellules 44px + dots colorés, chips de filtres, listes par jour (§7.2).
7. **Drops** (`/mvs`) + **fiche MV** : rail, chart top rated (nouveau), grille ; player, like, module notation avec histogramme de distribution (nouveau), commentaires restylés (§7.4, §7.7).
8. **Groups** + **fiche groupe** : tuiles carrées visuelles + trending ; bannière, stats strip, LinksBar en couleurs de marque, events, rail MV, membres (§7.5, §7.6).
9. **Search** : nouvelle route `/search` branchée sur groupes + MV + events (§7.3).
10. **Profil** : fan card + recent ratings + settings rows (§7.8).
11. **Landing** : refonte complète de `landing.tsx` (§7.9) — countdown live en preuve, mur visuel, 3 étapes, double CTA.
12. **QA** : critères de fin §12 du README — grep des valeurs v1 restantes, bascule des thèmes sur chaque page, lint a11y, comparaison visuelle avec le prototype.

À chaque étape, montre-moi un diff résumé avant de passer à la suivante.
