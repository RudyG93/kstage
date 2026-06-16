# Handoff : refonte du thème KStage — « Daylight / Midnight »

## Vue d'ensemble

Rafraîchissement **du thème uniquement** de l'app KStage (calendrier d'events k-pop, Next.js + Tailwind v4 + shadcn). **Les dispositions, blocs et la structure des pages ne changent pas.** On modernise l'habillage : on remplace le dégradé violet→rose daté par un système periwinkle + menthe, on passe les cernes durs en ombres douces, on aère, et on réserve la typo mono aux vraies données.

Le thème fonctionne en **deux peaux pilotées par le toggle clair/sombre existant** (`.dark`) :

- **Daylight** (clair, `:root`) — blanc cassé chaud, accent periwinkle, accent serif italique.
- **Midnight** (sombre, `.dark`) — bleu encre profond (fini le violet-noir), accent menthe électrique, profondeur douce.

## À propos des fichiers de design

Les fichiers de `mockups/` sont des **références visuelles créées en HTML** (`.dc.html`) — des prototypes qui montrent l'intention de design, **pas du code à copier tel quel**. Ta tâche est de **reproduire ce thème dans le codebase Next.js existant**, avec ses patterns établis (composants shadcn, classes Tailwind, tokens CSS). Tu n'importes jamais le HTML : tu édites les `.tsx` réels.

Ouvre les `.dc.html` dans un navigateur pour voir le rendu cible (le toggle ☀/☾ en haut à droite bascule Daylight/Midnight ; la nav du header montre les 4 écrans : Upcoming, Calendar, MVs, Groups).

## Fidélité

**Haute fidélité (hifi).** Couleurs, rayons, ombres et typo sont définitifs. Reproduis fidèlement, mais **via les tokens** (jamais de hex en dur) pour que les deux modes suivent.

---

## Étape 0 — le CSS (déjà fourni, peut-être déjà fait)

Remplace `src/app/globals.css` par le `globals.css` de ce bundle. C'est la base : fonds, cartes, neutres, primary, et les nouveaux tokens sémantiques `--teal / --amber / --rose / --faint`, plus les utilitaires `.gradient-text`, `.gradient-signature`, `.shadow-soft`.

> ⚠️ **Important** : coller le CSS ne suffit pas à voir le changement. Les blocs les plus visibles ont des **couleurs en dur** et des **cernes durs** dans les `.tsx`. Les étapes ci-dessous sont ce qui rend le changement visible. Relancer le serveur après modif du `globals.css` (Tailwind v4 ne recharge pas toujours les tokens à chaud).

---

## Étape 1 — polices (`src/app/layout.tsx`)

Garder Geist + Geist Mono + Bricolage. **Ajouter** Space Grotesk (chiffres) et Instrument Serif (accent wordmark) :

```ts
import {
  Geist,
  Geist_Mono,
  Bricolage_Grotesque,
  Space_Grotesk,
  Instrument_Serif,
} from 'next/font/google'

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})
const instrument = Instrument_Serif({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
})
```

Ajouter les deux variables au `className` du `<html>` :

```tsx
className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${spaceGrotesk.variable} ${instrument.variable} h-full antialiased`}
```

Et `viewport.themeColor` : `#0e0e13` → **`#0f1118`**.

---

## Étape 2 — remplacer les couleurs en dur (le cœur du sujet)

Cherche dans tout `src/` ces hex et remplace-les par des tokens :

| En dur                                         | Remplacer par                                           |
| ---------------------------------------------- | ------------------------------------------------------- |
| `#8b5cff` (violet)                             | `var(--primary)` (ou `#5b5bf0` si valeur fixe attendue) |
| `#ff2d87` (rose)                               | `var(--teal)` (ou `#3fe0b8`)                            |
| `#0e0e13` (fond OG/themeColor)                 | `#0f1118`                                               |
| `from-[#8b5cff] to-[#ff2d87]` (dégradé texte)  | classe `gradient-text`                                  |
| `from-[#8b5cff] to-[#ff2d87]` (dégradé bouton) | `bg-primary text-primary-foreground`                    |
| `accent-[#8b5cff]` (sliders)                   | `accent-[#5b5bf0]`                                      |

**Fichiers concernés** (repérés par grep) :

- `components/home/next-drop-card.tsx` — l'overlay radial-gradient (ligne ~25) : remplacer les deux hex par `var(--primary)` et `var(--teal)`.
- `components/landing.tsx` — le mot « comeback » (`gradient-text`) + le bouton « Get started » (`bg-primary text-primary-foreground shadow-primary/25`).
- `app/opengraph-image.tsx` — `backgroundColor: '#0e0e13'` → `'#0f1118'` ; `linear-gradient(90deg, #8b5cff, #ff2d87)` → `'#5b5bf0, #3fe0b8'`.
- `components/account/avatar-cropper.tsx`, `components/admin/banner-cropper.tsx` — `accent-[#8b5cff]` → `accent-[#5b5bf0]`.

Note : `.gradient-signature` (utilisé par le fallback d'avatar du next-drop) est déjà redéfini dans le `globals.css` (periwinkle→menthe), donc il se met à jour automatiquement.

---

## Étape 3 — cernes durs → ombres douces (le « plus aéré »)

Find & replace global dans `src/` :

```
ring-1 ring-foreground/10   →   border border-border shadow-soft
```

Variantes hover à ajuster au cas par cas : `hover:ring-foreground/20` → `hover:shadow-md`.

**~15 occurrences**, notamment : `home/sidebar-left.tsx`, `home/sidebar-right.tsx`, `group-card.tsx`, `next-drop-card.tsx`, `ui/dialog.tsx`, `ui/dropdown-menu.tsx`, `account/*`, `profile/*`, `home/group-filter.tsx`, `home/type-filter-vertical.tsx`, `app/u/[username]/page.tsx`, `onboarding/onboarding-grid.tsx`.

(Pour les éléments actifs/sélectionnés comme `onboarding-grid` ou `type-filter`, garder un `ring-2 ring-primary` sur l'état actif — c'est volontaire.)

---

## Étape 4 — alléger la typo mono (le « moins de bruit »)

Les titres de section utilisent `font-mono uppercase tracking-[0.18em]` → ça fait « terminal ». Les passer en clair :

```
font-mono text-[11px] tracking-[0.18em] uppercase   →   text-xs font-semibold text-faint
```

sur les **labels de section** uniquement (Filters, This week, My groups, Recent comebacks, badge « K-pop event calendar » du landing…).

**Garder le mono** sur les vraies données : heures KST, compteurs (`Countdown`), dates, nombres. Idéalement, leur appliquer `font-numeric tabular-nums` (Space Grotesk) pour des chiffres nets — voir `components/home/countdown.tsx`.

---

## Étape 5 — couleurs d'event (`src/lib/events/labels.ts`)

`EVENT_TYPE_COLORS` est consommé en hex brut (barres/pastilles). Jeu unique lisible en clair ET sombre :

```ts
export const EVENT_TYPE_COLORS = {
  comeback: '#6d6bf2', // periwinkle
  mv: '#20bfae',
  release: '#20bfae', // menthe
  music_show: '#d49830', // ambre
  live: '#e85d8a', // rose
  anniversary: '#8b90a3',
  other: '#8b90a3',
}
```

---

## Tokens de référence

| Rôle                        | Daylight  | Midnight                |
| --------------------------- | --------- | ----------------------- |
| Fond app                    | `#faf9f7` | `#0f1118`               |
| Carte                       | `#ffffff` | `#1b1e2a`               |
| Encre                       | `#1c1c24` | `#eef0f5`               |
| Texte secondaire            | `#6b6b74` | `#8b90a3`               |
| Texte tertiaire (`--faint`) | `#9a9aa2` | `#6b7088`               |
| Hairline (`--border`)       | `#efedeb` | `rgba(255,255,255,.09)` |
| Primary (periwinkle)        | `#5b5bf0` | `#8785ff`               |
| Teal — MV/release           | `#1aa99f` | `#3fe0b8`               |
| Amber — music show          | `#c4801c` | `#e6ad4c`               |
| Rose — live                 | `#dd5285` | `#ef6a9b`               |
| Rayon (`--radius`)          | `1rem`    | `1rem`                  |

Toutes converties en oklch dans `globals.css`. Polices : titres = Bricolage Grotesque ; chiffres = Space Grotesk ; accent éditorial = Instrument Serif italique ; corps = Geist.

---

## Critère de fin

- Aucun `#8b5cff` / `#ff2d87` / `#0e0e13` restant dans `src/`.
- Plus de `ring-1 ring-foreground/10` (sauf états actifs voulus).
- Le toggle clair/sombre bascule proprement Daylight ↔ Midnight sur toutes les pages.
- Comparer visuellement avec les `.dc.html` du bundle.

## Fichiers du bundle

- `globals.css` — le drop-in pour `src/app/globals.css`.
- `INTEGRATION.md` — notes détaillées (doublon partiel de ce README, utile en référence).
- `mockups/KStage Home.dc.html` — l'app complète cible (4 écrans + toggle). **Ouvrir dans un navigateur.**
- `mockups/KSidebarLeft.dc.html`, `KSidebarRight.dc.html` — les sidebars.
- `mockups/KStage Refresh.dc.html` — le board de recherche (diagnostic + 3 directions explorées, dont A=Daylight et C=Midnight retenues).
