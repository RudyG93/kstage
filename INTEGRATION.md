# KStage — intégration du thème « Daylight / Midnight »

> **État (2026-06-16)** : **intégration complète** (handoff `design_handoff_kstage_theme/`). En plus de §1 (fonts), §2 (wordmark serif + themeColor #0f1118), §3 (EVENT_TYPE_COLORS) déjà faits, ce passage applique :
>
> - **Couleurs en dur → tokens** : plus aucun `#8b5cff` / `#ff2d87` / `#0e0e13` dans `src/` (landing hero + bouton, `next-drop-card` radial-gradient, `opengraph-image`, `icon.svg`, email `resend.ts`, sliders croppers). Le mot « comeback » et la signature passent par `.gradient-text` periwinkle→menthe.
> - **§4 allègement visuel** : cernes `ring-1 ring-foreground/10` → `border border-border shadow-soft` sur les cartes/panneaux/overlays (~18 occurrences) ; les états **sélectionnés** (`onboarding-grid`, filtre de type actif) gardent volontairement un `ring`. Labels de section mono `tracking-[0.18em]` → `text-faint text-xs font-semibold` (sidebars, feed, /mvs, badge landing) ; le **mono reste sur les données** (heures KST, compteurs, dates, counts).
>
> Vérifié au rendu en computed-styles (Daylight + Midnight) : tokens `--primary`/`--teal`/`--faint`/`--radius` résolus, bascule du toggle propre, 5 polices chargées.
>
> **Suite revue a11y (2026-06-16)** : contraste mesuré (WCAG, getImageData) sur les labels `text-faint`. Daylight était à 2,79:1 sur carte blanche (< 3:1) → token `--faint` Daylight assombri `oklch(0.689→0.635)` → **3,43:1**, aligné sur Midnight (3,4:1), tout en restant « discret ». Sliders croppers : `dark:accent-[#8785ff]` ajouté (le periwinkle Midnight au lieu du Daylight sur fond sombre). **Choix assumé** : en Daylight la séparation des cartes (`border-border` ~1,1:1 sur carte blanche + `shadow-soft`) est volontairement douce (intention « aéré » du handoff + mockups, pattern light-mode standard) — non modifié.
>
> **Fidélité maquettes — feed (2026-06-16)** : suite au constat de Rudy (« l'app ne ressemble pas aux maquettes »), `home/event-card.tsx` est réécrit pour matcher `mockups/KStage Home.dc.html`. L'ancienne **bannière plein-cadre à scrim noir** devient une **carte claire** : carré d'identité du groupe à gauche (image, sinon initiale teintée `color_hex`), titre + pastille de type, **heure KST 24 h** (Space Grotesk) + heure locale à droite, « All day » pour les anniversaires. Le compte à rebours par carte est retiré (la maquette ne le met que sur le hero next-drop) → `CountdownBadge`/`formatShort` supprimés. Vérifié au rendu sur `/calendar` (qui réutilise `HomeEventCard`), Daylight + Midnight. ⇒ le §4 « Feed » ci-dessous est désormais **fait** (n'était qu'« optionnel »). NB : le handoff cadrait « thème seulement » ; la demande de Rudy de coller aux maquettes prime.

Remplace le contenu de `src/app/globals.css` par `kstage-theme/globals.css`.
Le système reste 100 % shadcn / Tailwind v4 : **aucun composant à réécrire**, les
tokens (`--background`, `--card`, `--primary`…) sont juste re-mappés. Le toggle
clair/sombre existant (`.dark`) pilote tout.

---

## 1. Polices (`src/app/layout.tsx`)

On garde Geist + Geist Mono + Bricolage, on **ajoute** Space Grotesk (chiffres)
et, en option, Instrument Serif (accent du wordmark).

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

Puis ajoute les variables au `<html className>` :

```tsx
className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${spaceGrotesk.variable} ${instrument.variable} h-full antialiased`}
```

Pour les countdowns / heures / compteurs, applique `font-numeric` (ou la classe
`tabular`) : `<span className="font-numeric tabular-nums">02</span>`.

---

## 2. Wordmark

Remplace le `bg-gradient-to-r from-[#8b5cff] to-[#ff2d87]` par l'accent serif :

```tsx
<span className="font-heading text-lg font-bold tracking-tight">
  K<span className="font-serif font-normal italic">stage</span>
</span>
```

`viewport.themeColor` (layout.tsx) → passe de `#0e0e13` à **`#0f1118`**.

---

## 3. Couleurs d'event (`src/lib/events/labels.ts`)

`EVENT_TYPE_COLORS` est utilisé en hex brut (barres/pastilles) sur fond variable.
Jeu unique lisible en clair **et** sombre :

```ts
export const EVENT_TYPE_COLORS = {
  comeback: '#6d6bf2', // periwinkle (primary)
  mv: '#20bfae', // menthe (teal)
  release: '#20bfae',
  music_show: '#d49830', // ambre
  live: '#e85d8a', // rose
  anniversary: '#8b90a3', // neutre
  other: '#8b90a3',
}
```

(Idéalement, à terme : lire `var(--teal)`/`var(--amber)`… au lieu d'un hex figé,
pour qu'elles suivent aussi le mode.)

---

## 4. Allègement visuel (recommandations, non bloquant)

Le thème fournit les tokens ; ces ajustements donnent le côté « aéré » :

- **Cartes** : remplacer `ring-1 ring-foreground/10` par `border` + `shadow-soft`
  (utilitaire fourni). Ex. `event-card`, `next-drop-card`, sidebars.
- **Labels de section** : enlever `font-mono uppercase tracking-[0.18em]` sur les
  titres (Filters, This week, My groups…) → `text-xs font-semibold text-faint`.
  Garder le **mono uniquement** sur les vraies données (heures KST, compteurs, dates).
- **Feed** (`home/event-card.tsx`) : la version allégée (carte claire + pastille
  de type + heure) remplace la bannière plein-cadre à scrim noir. Optionnel —
  garder les bannières si tu y tiens, elles marchent avec les nouveaux tokens.
- **Rayons** : `--radius` passe à `1rem` (cartes `rounded-2xl` un poil plus douces).

---

## 5. Rappel des valeurs

| Rôle                 | Daylight  | Midnight  |
| -------------------- | --------- | --------- |
| Fond app             | `#faf9f7` | `#0f1118` |
| Carte                | `#ffffff` | `#1b1e2a` |
| Encre                | `#1c1c24` | `#eef0f5` |
| Primary (periwinkle) | `#5b5bf0` | `#8785ff` |
| Teal (MV)            | `#1aa99f` | `#3fe0b8` |
| Amber (show)         | `#c4801c` | `#e6ad4c` |
| Rose (live)          | `#dd5285` | `#ef6a9b` |

Toutes converties en oklch dans `globals.css`.
