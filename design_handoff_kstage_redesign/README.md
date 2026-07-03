# Handoff : refonte « Data Desk » — KStage v2

> Bundle autoportant pour implémenter la refonte visuelle validée (juillet 2026) dans le codebase KStage existant (Next.js 16 · Tailwind v4 · Base UI · lucide-react · next-themes).
> Direction retenue : **« Data Desk »** — dense / dark / data-forward façon HLTV (≈80%), relevée de moments visuels image-forward (≈20%) : hero comeback aux couleurs du groupe, thumbnails YouTube, preuve sociale.

---

## 1. Vue d'ensemble

Cette refonte remplace l'habillage « Daylight/Midnight v1 » (periwinkle doux, rayons 1rem, halos d'atmosphère) par une identité plus dense et outillée :

- **La donnée est le décor** : D-days, countdowns, files d'events, chart hebdo, ticker live.
- **Le visuel là où le contenu est visuel** : hero comeback en gradient du groupe, grilles de MV (thumbnails YouTube réelles en prod), tuiles groupes.
- **La communauté présente mais secondaire** : strip d'activité sur la home, discussion complète sur la fiche MV uniquement.
- **Architecture de nav mise à jour** : bottom-nav 5 onglets avec **Search central**, profil via l'avatar du header.

Objectif produit (audit UX 2026-06) : rétention — tuer le vide, countdowns partout, différenciateur notes/commentaires visible, app-feel mobile.

## 2. À propos des fichiers de design

Les fichiers de `mockups/` sont des **références visuelles créées en HTML** (`.dc.html`, à ouvrir dans un navigateur) — des prototypes montrant l'intention, **pas du code à copier**. La tâche est de **recréer ces écrans dans le codebase Next.js existant**, avec ses patterns (composants `src/components/`, classes Tailwind, tokens CSS, Base UI). On n'importe jamais le HTML : on édite les `.tsx` réels.

- `mockups/KStage Prototype — Round 2.dc.html` — **la cible**. Prototype navigable : 9 écrans, tout est cliquable (onglets, fiches, retour, follow, like, slider de notation, bascule landing/app en haut du board).
- `mockups/KStage Redesign — Round 1.dc.html` — le board d'exploration (3 directions). Référence historique : 1b a été retenue, mixée à 1a. Ne pas implémenter 1c.
- Les mockups nécessitent `support.js` et `ios-frame.jsx` (fournis) dans le même dossier. Le cadre iPhone fait partie du mockup, pas du produit.

## 3. Fidélité

**Haute fidélité (hifi).** Couleurs, typographies, rayons, densités, espacements et copies sont définitifs — reproduis fidèlement, mais **via les tokens** (jamais de hex en dur hors `globals.css` / `EVENT_TYPE_COLORS`). Les mockups sont mobile-first (402px). Le desktop reprend le layout 3 colonnes existant avec les mêmes tokens/composants (non maquetté dans ce bundle).

Nuances :

- Les **gradients + monogrammes** des groupes/MV dans les mockups sont des **placeholders** : en prod, utiliser les vraies images (Deezer/TheAudioDB/YouTube) avec fallback gradient `color_hex` du groupe (mécanisme existant).
- Les données (aespa D-2, notes, comptes) sont factices mais les **formats** sont normatifs (D-day, `18:00 KST · 11:00 local`, score `9.1`, `· 342`).

## 4. Design tokens (drop-in : `globals.css` fourni)

Remplacer `src/app/globals.css` par le `globals.css` de ce bundle. Ce qui change vs v1 :

| Rôle                            | Token                     | Daylight              | Midnight                |
| ------------------------------- | ------------------------- | --------------------- | ----------------------- |
| Fond extérieur                  | `--page`                  | `#E9EAEE`             | `#08090E`               |
| Surface app                     | `--background`            | `#F4F5F7`             | `#0B0D12`               |
| Carte / panneau                 | `--card`                  | `#FFFFFF`             | `#10131A`               |
| Panneau secondaire              | `--secondary` / `--muted` | `#ECEDF1`             | `#12151C`               |
| Encre                           | `--foreground`            | `#16181D`             | `#E8EBF4`               |
| Texte secondaire                | `--muted-foreground`      | `#5C6472`             | `#9BA3B7`               |
| Texte tertiaire                 | `--faint`                 | `#8A93A3`             | `#5F6779`               |
| Hairline                        | `--border`                | `#E4E5EA`             | `rgba(255,255,255,.08)` |
| **Primary (periwinkle affûté)** | `--primary`               | `#4E4AE8`             | `#7D7AFF`               |
| MV / release                    | `--teal`                  | `#0F9E80`             | `#2FD4AC`               |
| Music show                      | `--amber`                 | `#B97F1E`             | `#E3A83C`               |
| Live / concert                  | `--rose`                  | `#D64C7E`             | `#E85D8A`               |
| **LIVE NOW (nouveau)**          | `--live`                  | `#E03131`             | `#FF4757`               |
| Rayon de base                   | `--radius`                | **`0.625rem`** (10px) | idem                    |

Valeurs oklch exactes dans le `globals.css` fourni. Autres changements structurels :

- **Halos d'atmosphère supprimés** (le `.dark body` v1 avait 2 radial-gradients fixes). Le seul « glow » autorisé est local : gradient de marque DANS le hero comeback et bannière groupe.
- `--primary-foreground` : **encre sombre sur primary en Midnight** (`#0B0D12` sur `#7D7AFF`), blanc en Daylight.
- Rayons : cartes/panneaux `rounded-[10px]` (lg), thumbnails `rounded-[7px]` (md), tags/chips `rounded-[4px]`–`[6px]`, bannière hero `rounded-xl` (12px). Fini le 1rem généreux.

### Couleurs d'event (`src/lib/events/labels.ts`)

```ts
export const EVENT_TYPE_COLORS = {
  comeback: '#7D7AFF', // primary
  mv: '#2FD4AC',
  release: '#2FD4AC',
  music_show: '#E3A83C',
  live: '#E85D8A',
  concert: '#E85D8A',
  anniversary: '#8b90a3',
  other: '#8b90a3',
}
```

(Consommées en hex brut par les pastilles/barres — jeu unique lisible sur les deux thèmes.)

## 5. Typographie

| Famille               | Variable           | Usage                                                                                 | Notes              |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------- | ------------------ |
| Geist Sans            | `--font-sans`      | corps, titres de lignes                                                               | inchangé           |
| Bricolage Grotesque   | `--font-heading`   | h1-h4, wordmark « K », gros titres hero (20-34px, 800, tracking −0.02em), monogrammes | inchangé           |
| Space Grotesk         | `--font-numeric`   | **tous les chiffres** : countdowns, D-days, heures, scores, compteurs (`tnum`)        | inchangé           |
| **Archivo (NOUVEAU)** | `--font-condensed` | **labels de section et micro-labels** : uppercase, condensé, 8–10px                   | variable `wdth`    |
| Instrument Serif      | `--font-serif`     | accent éditorial rare (italique du mot final du hero landing)                         | usage réduit vs v1 |

**Le pattern signature des labels** (remplace le `font-mono uppercase` v1) :
`font-condensed, font-stretch: 78%, font-weight: 700, letter-spacing: .18em, uppercase, 9.5px, color: muted-foreground` — ex. `NEXT UP — YOUR GROUPS`, `UPCOMING QUEUE`, `TOP RATED — THIS WEEK`. Variante inline : `font-stretch: 82%, letter-spacing: .1–.12em`.

`src/app/layout.tsx` — ajouter :

```ts
import { Archivo } from 'next/font/google'
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  axes: ['wdth'],
  weight: 'variable',
})
```

et `viewport.themeColor` → `#0B0D12`.

## 6. Navigation (SiteNav)

**Bottom-nav mobile — 5 items** (hauteur ~64px + safe-area, fond `#0E1118`/Daylight `card`, border-top hairline) :

| Onglet                    | Icône lucide | Route                |
| ------------------------- | ------------ | -------------------- |
| HOME                      | `house`      | `/`                  |
| CALENDAR                  | `calendar`   | `/calendar`          |
| **SEARCH (central, FAB)** | `search`     | `/search` (nouvelle) |
| DROPS                     | `disc-3`     | `/mvs`               |
| GROUPS                    | `users`      | `/groups`            |

- Le FAB Search : carré 46px, `rounded-[14px]`, `bg-primary`, icône encre sombre, `translateY(-14px)`, ombre `0 8px 20px rgba(125,122,255,.4)`.
- Labels : pattern condensé 8.5px, actif = `primary`, inactif = `faint`.
- « Upcoming » est renommé **Home**. « MVs » devient **Drops** (wording à valider — sinon garder MVs, le design ne change pas).
- Profil : via l'avatar en fin de header (plus d'onglet dédié). Header desktop : mêmes 5 entrées en horizontal.

## 7. Écrans (9) — specs et mapping composants

Toutes les mesures = mockup mobile 402px. Padding horizontal page : 12px ; padding interne panneau : 12px ; gap grilles : 9px. Un « panneau » = `bg-card border border-border rounded-[10px]`, avec header interne `padding 8px 12px + border-b` portant le label condensé.

### 7.1 Home — `/` (refonte de `home/*`)

Ordre vertical :

1. **Header sticky** (z-20, fond background/96 + blur) : logo K (27px, `rounded-[8px]`, bg primary, « K » Bricolage 800 encre sombre) + « STAGE » condensé letterspacing .22em ; **champ recherche factice** (33px, bg secondary, placeholder « Groups, MVs, events… ») → route `/search` ; cloche avec dot amber ; avatar 29px → profil.
2. **Ticker live** (nouveau composant) : bande 30px, bg `#0E1118`, border-y hairline. Contenu : événements du jour/à venir en labels condensés (`LIVE TONIGHT — M COUNTDOWN 18:00 KST` avec dot `--live` pulsant, `AESPA COMEBACK D-2`…). Défilement : contenu dupliqué ×2, `translateX(0→−50%)`, **26s linear infinite**. Pause au hover. `prefers-reduced-motion` : statique.
3. **Hero « NEXT UP »** (évolution de `NextDropCard`) : panneau avec header label + lien ALL. Corps cliquable → fiche groupe : `border-left 3px primary`, fond **gradient de marque du groupe** (115deg, `color_hex` à 28% → transparent 75%) + scanlines subtiles ; image/monogramme 62px `rounded-[10px]` ; tag type + `D-2` ; titre Bricolage 20px 800 ; méta `Sun Jul 5 · 18:00 KST · 11:00 local` ; **countdown 4 cellules** (49px, bg background/60, chiffres Space Grotesk 21px 700, labels 7.5px condensés, secondes en primary, tick 1s) ; avatars empilés + `1,248 WAITING` (nowrap) ; **CTA « NOTIFY ME »** (pilule encre claire sur fond sombre, nowrap).
4. **UPCOMING QUEUE** (`EventList` variante dense) : lignes 40px — `border-left 2px` couleur type, col D-day (38px, Space Grotesk, couleur type), tag type (50px, 8px condensé, bg type/12%), titre + sous-titre, heure KST, cloche (remplie = notif armée). Lien header → Calendar.
5. **THIS WEEK** (nouveau `WeekGlance`) : 7 cellules (jour condensé 8.5px, date Space Grotesk 13px, dots 4px couleur type). Aujourd'hui : bg primary/10 + border primary. → Calendar.
6. **FRESH DROPS — RATE THEM** : grille 2 col de `MvCard` : thumbnail 16:9 `rounded-[7px]` (YouTube réel, placeholder = gradient groupe) + play 26px + durée ; titre 11.5px 600 ; ligne note : étoile amber + score Space Grotesk + `· count` + **chip RATE** (outline primary ; si 0 note : « Be the first to rate » + chip pleine primary, border du panneau en dashed primary/45).
7. **Community strip** : panneau 2 lignes max (avatar 18px + `@user rated X 9 — “…”` tronqué + âge). Pas plus — la discussion vit sur la fiche MV.
8. **Footer statut** : `12 SOURCES SCRAPED · UPDATED 2 MIN AGO` — Space Grotesk 9px letterspacing .18em, `--faint` réduit. Signature data-forward.

### 7.2 Calendar — `/calendar` (`CalendarMonth`)

- Header sticky : titre Bricolage 17px + pager mois (panneau `‹ JUL 2026 ›`, Space Grotesk).
- Rangée **filtres type** (chips scrollables) : ALL actif = encre inversée ; chaque type = dot + label condensé 9px, bg type/8-12% + border type/30. Rangée 2 : `MY GROUPS` / `EVERYONE` + compteur `14 EVENTS`.
- **Grille mois** dans un panneau : en-têtes MON→SUN condensés 8px ; cellules **44px** `rounded-[7px]` bg secondary, date Space Grotesk 11px, **dots 4px** couleur type (fini les pastilles minuscules illisibles v1) ; aujourd'hui : bg primary/12 + border primary, date primary ; jour de comeback : ring primary/35 ; hors-mois : date faint sans fond.
- **Listes par jour** sous la grille : header label `THU JUL 2 — TODAY` + `n EVENTS`, puis panneau de lignes denses (identiques à la queue, avec vignette 40px du groupe). Événement du soir : countdown `in 07:22:14` teal.

### 7.3 Search — `/search` (NOUVELLE page + FAB nav)

- Champ 40px focus (border primary/50 + ring primary/12, caret animé), `Cancel`.
- Segments condensés : ALL / GROUPS / MVS / EVENTS.
- Résultats groupés par sections labellisées : **TOP RESULT** (carte groupe : image 46px, nom, `Group · agence · 12.4k followers`, bouton FOLLOWING/FOLLOW), **MVS** (lignes thumbnail 56px + score), **EVENTS** (lignes queue). Phrase pied : « Search covers groups, artists, MVs and events ».
- Implémentation données : réutiliser groupes + events + MV (recherche globale = gap connu de l'audit).

### 7.4 Drops — `/mvs`

1. **FROM YOUR GROUPS** : rail horizontal de cartes 172px (thumbnail 16:9 + play + durée, titre, score `· count · 2d ago`) — `MvScrollRow` existant restylé.
2. **TOP RATED — THIS WEEK** (nouveau `MvChart`) : panneau lignes : rang Space Grotesk (n°1 amber), titre + `groupe · n ratings`, **barre de score** (track 64×4px white/8, fill gradient primary→teal, largeur = score×10%), score 12.5px, **delta** `▲2` teal / `▼1` rose / `—` faint / `NEW` amber condensé. Lien `JUNE PODIUM →` (winner mensuel existant).
3. **LATEST DROPS** : grille 2 col `MvCard` (cf. 7.1.6) + tri `SORT: NEW ▾`.

### 7.5 Groups — `/groups` (`GroupsGrid`, `GroupCard`)

- Header : titre + toggle GROUPS/SOLO (segments condensés) + tri `POPULAR ▾`.
- **FOLLOWING — n** : grille 2 col de tuiles **carrées** `rounded-[12px]` : photo (placeholder gradient) + scrim bas `→ rgba(page,.85)` + nom Bricolage 15px 800 + **ligne statut** (dot type + `COMEBACK D-2` Space Grotesk 9.5px) + cœur follow 28px en haut-droite (bg page/50). La tuile porte le prochain event = countdown partout.
- **TRENDING THIS WEEK** : panneau lignes : rang, vignette 32px, nom + contexte (`JYP · on M Countdown tonight`), `▲ 840 follows` teal, cœur outline (rempli si suivi).

### 7.6 Fiche groupe — `/groups/[slug]` (`ArtistHero`, `LinksBar`, `EventList`, `MvsGrid`, `MembersGrid`)

1. **Bannière 210px** : image (fallback gradient `color_hex` 150deg + scanlines + monogramme géant white/10 en bas-droite) ; boutons ronds flottants (back, share) bg page/55 + blur ; en bas : tags `GROUP` + `COMEBACK D-2`, nom Bricolage 30px 800 (text-shadow), `agence · debut · n members` ; **bouton FOLLOW/FOLLOWING** (toggle optimiste : FOLLOWING = outline rose + cœur rempli ; FOLLOW = pilule encre claire).
2. **Stats strip** : panneau 4 cols séparées par hairlines : `12.4k FOLLOWERS · 8 UPCOMING · 8.9 AVG SCORE · LINKS` — les liens sociaux en **icônes couleur de marque** (YouTube rouge, Instagram, Spotify vert…), fini le monochrome v1.
3. **UPCOMING — [groupe]** : lignes queue + lien `+ SUGGEST` (dialog existant).
4. **MVS — n** : rail 150px (winner du mois : tag `JUNE WINNER` amber) + carte placeholder dashed pour le MV annoncé (`D-2 · WHIPLASH MV · Notify is on`).
5. **MEMBERS — n** : rail 84px : portrait `rounded-[12px]` (fallback silhouette), nom, `position · année`. **Bias** : ring dorée + ★ (donnée profil existante).

### 7.7 Fiche MV — `/mv/[slug]` (`YoutubeEmbed`, `LikeButton`, `RatingSlider`, `CommentSection`)

1. **Player 16:9** full-bleed (YouTube embed réel) + back flottant.
2. Titre Bricolage 20px + `groupe · MV · dropped 2 days ago` + **bouton like** (cœur + compteur, toggle optimiste rose) — le geste léger découplé de la note.
3. **Panneau notation** : gauche = moyenne 30px + 5 étoiles + `342 ratings` ; droite = **histogramme de distribution 1→10** (barres 44px max, dégradé de gris → primary vers les hautes notes) — nouveau, signature data-forward. Dessous (border-t) : `YOUR RATING` + valeur primary 16px + **slider 0-10 pas 0.5** (track 6px, fill gradient primary→teal, thumb 16px) + bouton SAVE (chip pleine primary).
4. **DISCUSSION — n** + toggle TOP/NEW (segments condensés). Commentaires en panneaux : avatar 22px, `@user`, **badge note** amber si l'auteur a noté, âge ; corps 12px/1.55 ; actions vote ▲128▼ (up actif teal) + Reply + Share ; réponses imbriquées : `border-left 2px primary/35` + fond `#0E1118`. Composer sticky-bas : avatar + « Join the discussion… » + send primary.

### 7.8 Profil — `/u/[username]` (+ raccourcis réglages de `/account`)

1. Header back + titre + roue crantée (→ `/account`).
2. Identité : avatar 64px (ring primary), `@mel` + badge tier condensé, `Fan since Mar 2026 · Paris (UTC+2)`, bouton EDIT.
3. **FAN CARD — 2026** (le « CV de fan », partageable) : panneau border primary/30, fond gradient primary/16→teal/7, filigrane « K » géant ; 4 stats (FOLLOWING 12 · RATED 34 · AVG 7.8 amber · LIKES 86 rose) ; ligne ult/bias : `Ult group aespa · bias Winter ★` + `TOP 4% RATERS` ; bouton SHARE (génère une image — hook viral, backlog « Wrapped »).
4. **YOUR RECENT RATINGS** : lignes thumbnail 50px + titre + date + badge note amber.
5. **SETTINGS** : lignes : Push notifications (toggle 34px, sous-titre `Comebacks: announced + day-of…`), Theme (`Midnight — Daylight available`), Weekly digest (toggle).

### 7.9 Landing — `/` déconnecté (`Landing.tsx` — refonte complète)

Remplace le « mur de noms » v1 :

1. Top bar : logo + `Log in` ghost + `Sign up` (pilule encre claire).
2. Halo discret primary/20 en haut (seule exception « glow » hors panneaux — page marketing).
3. Badge `● 2,400+ EVENTS TRACKED LIVE` (dot teal pulsant) ; **H1 Bricolage 34px** : « Never miss a comeback _again._ » (again. en Instrument Serif italique primary) ; sous-titre 12.5px.
4. **Preuve live** : panneau `HAPPENING ON KSTAGE RIGHT NOW` (dot live pulsant) + ligne comeback avec **countdown temps réel** — la donnée vend le produit.
5. **Mur visuel** : `184 GROUPS & SOLOISTS` — grille 3 col de tuiles images + tuile `+178`.
6. Proof bar 4 stats : `2.4k EVENTS · 184 GROUPS · 6 SHOW SOURCES · 1h REFRESH`.
7. **3 étapes** (lignes numérotées) : Follow → Get pinged (timezone) → Rate every drop /10 (« The Letterboxd of k-pop »).
8. CTA : `Create your calendar — free →` (pleine primary, ombre primary/30) + `Browse the calendar first →` ghost (accès calendrier sans compte — gap audit) + mention `PWA — INSTALL FROM YOUR BROWSER · NO APP STORE`.

## 8. Interactions & motion (CSS/Tailwind uniquement — pas de lib)

| Élément       | Spéc                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Countdowns    | tick 1s (`setInterval`), chiffres `tnum` zéro-paddés, secondes colorées primary. Composant `Countdown` existant à upgrader |
| Ticker        | marquee CSS 26s linear infinite (contenu ×2, `translateX −50%`), pause hover, statique si `prefers-reduced-motion`         |
| Dots LIVE     | pulse opacity 1→.3, 1.2s (live) / 1.6s (à venir)                                                                           |
| Follow / Like | optimistic update existant ; transitions colors 150ms                                                                      |
| Slider note   | `input range` 0-10 step 0.5 natif stylé (track/fill/thumb), fill = gradient primary→teal                                   |
| Navigation    | transitions de page Next.js standard ; pas de vue animée requise                                                           |
| Skeletons     | `Skeleton` existant, formes = nouveaux rayons                                                                              |

## 9. États & données

- Tous les états vides restent **actionnables** (`EmptyState` existant) : 0 note → « Be the first to rate » + chip pleine ; MV annoncé → carte dashed « Notify is on » ; pas d'event → CTA suggest.
- Compteurs sociaux (`n WAITING`) : masquer sous ~20 (pas de « 3 waiting » déprimant) — remplacer par le CTA seul.
- `LocalTime` existant pour `· 11:00 local` post-hydratation.
- Aucune nouvelle table requise ; « WAITING » peut réutiliser les notification opt-ins par event (sinon masquer la ligne, le design tient sans).

## 10. Accessibilité (ne pas régresser — Lighthouse 100 actuel)

- Contrastes vérifiés directionnellement : `--faint` réservé aux micro-labels ≥ caps 8px avec letterspacing ; texte porteur = `--muted-foreground` minimum.
- Hit targets ≥ 44px (les lignes denses font 40px de contenu + padding — OK).
- Focus visible : `ring-2 ring-primary` conservé sur tout interactif ; le FAB search a un focus ring contrasté.
- Ticker : `aria-hidden` sur la copie dupliquée ; contenu accessible en liste statique.
- `jsx-a11y` : conserver les patterns existants (boutons réels, pas de div cliquables).

## 11. Fichiers du bundle

- `README.md` — ce document.
- `CLAUDE_CODE_PROMPT.md` — prompt prêt à coller dans Claude Code.
- `globals.css` — drop-in pour `src/app/globals.css` (tokens oklch Daylight + Midnight, fonts, utilitaires).
- `mockups/KStage Prototype — Round 2.dc.html` — **prototype cible navigable** (ouvrir dans un navigateur).
- `mockups/KStage Redesign — Round 1.dc.html` — board d'exploration (contexte).
- `mockups/support.js`, `mockups/ios-frame.jsx` — runtime des mockups (ne pas intégrer au produit).

## 12. Critères de fin

- `globals.css` v2 en place, aucune valeur v1 restante (`0.928 0.005 286`, halos `.dark body`, radius `1rem`).
- Bottom-nav 5 onglets avec FAB search central ; « Upcoming » → « Home ».
- Home = 8 modules de la section 7.1, countdown hero au tick.
- Les deux thèmes basculent proprement sur toutes les pages (`ThemeToggle` existant).
- Labels de section = Archivo condensé (plus de `font-mono uppercase` v1).
- Comparaison visuelle côte à côte avec le prototype : silhouettes identiques à ±4px.
