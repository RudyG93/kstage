# KStage — intégration du thème « Daylight / Midnight »

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
