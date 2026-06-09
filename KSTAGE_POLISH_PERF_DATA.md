# KStage — Polish, Performance & Data Quality

> Document **complémentaire** à `KSTAGE_MVP_FINALIZATION.md` et `KSTAGE_FIXES_AND_POLISH.md`.
> Concerne : refonte du système de notation, optimisations de performance, qualité du scraping, architecture multi-source.
> Respecter les règles du `CLAUDE.md` (réfléchir avant, simplicité, chirurgical, orienté objectif).

---

## État d'avancement (2026-06-09) — branche `feat/polish-perf-data`

- **§1 Notation slider [0,10]/0.5** : ✅ FAIT (migration `0028` à appliquer au merge).
- **§2.1 Audit perf** : ✅ FAIT → `docs/PERFORMANCE_AUDIT.md`. Verdict : filtres rapides (63ms) ; cibler **cold-start + landing + feedback de chargement** (PAS les filtres).
- **§4.1 isOfficialMV** : ✅ module + 23 tests (`src/lib/scrapers/is-official-mv.ts`) — **reste à câbler** dans le scraper YouTube.
- **§3.1 drag / §6 icônes couleur / §7 anniversaires (calendrier+compteur) / §3.2 bandeaux MVs** : ✅ FAITS & mergés (lot Quick-Polish, PR #77).
- **§8 Concerts** : ❌ **ABANDONNÉ** (Bandsintown = couverture k-pop faible ; Songkick = payant ; seule voie propre = clé Ticketmaster gratuite, non retenue). Concerts gardés via **suggestions manuelles + détection YouTube** existantes.
- **RESTE À FAIRE** : câbler §4.1, §4.2 multi-chaînes (via table `sources`, besoin des channel IDs), §4.3 scope ≥100k (`spotify_followers` + fetch), §5 images membres (kpopping via proxy Jina, fallback initiales seulement en cas extrême), §9 archi multi-source + `/admin/scraping`, §2 fixes (caching + loading states + landing).

## Décisions techniques actées (à ne PAS rediscuter)

- **Notation** : intervalle `[0.0, 10.0]` par pas de `0.5` (21 valeurs possibles). **UI : slider custom**, pas étoiles (incompatibles avec la valeur 0).
- **Édition de note** : autorisée (upsert). L'user peut modifier ou supprimer sa note.
- **Scraping étendu** : tous les artistes en DB avec **≥ 100k followers Spotify** (seuil configurable via env var).
- **Détection MV officiels** : whitelist titre + blacklist titre + uploader vérifié (multi-chaînes par groupe).
- **Multi-chaînes YouTube par groupe** : `Group.youtube_channel_ids[]` (array, pas single field).
- **Images membres individuels** : scraping multi-source (kpopping.com en principale).
- **Architecture data multi-source** : 3 niveaux explicites (principale / secondaire / tertiaire) par type de data.

---

# Section 1 — Système de notation (refonte)

## 1.1 Refonte UI : slider à la place des étoiles

**Problème** : les étoiles ne permettent pas de noter 0. Et le pas de 0.5 mal supporté visuellement.

**Refonte** :

- Remplacer le composant étoiles par un **slider custom** :
  - Range `[0, 10]` avec step `0.5`
  - **Ticks visuels** à chaque entier (0, 1, 2, ..., 10)
  - Affichage du score en grand à côté du slider, format `X.Y` (ex: `7.5`, `10.0`, `0.0`)
  - Couleur du slider : gradient (rouge → orange → vert), ou couleur d'accent KStage selon préférence design
  - Animations : transition fluide au déplacement du curseur
- **Composant à utiliser** : shadcn/ui `Slider` (gère nativement step et accessibility), customisé pour afficher les ticks
- Bouton **"Supprimer ma note"** (icône poubelle ou texte discret) qui remet la note à `null` côté DB

## 1.2 Édition d'une note existante

- Au mount du composant : récupérer la note actuelle de l'user (si existante) et initialiser le slider sur cette valeur
- À chaque changement de note : **upsert** dans `mv_vote` ou `release_vote` (`INSERT ... ON CONFLICT (user_id, target_id) DO UPDATE`)
- Feedback visuel : toast "Note enregistrée" (debouncé à 500ms pour éviter le spam si l'user fait glisser longtemps)
- Si l'user n'a pas encore voté : afficher le slider à `null` (curseur au centre désactivé, texte "Donne ta note")

**Critère d'acceptation** : un user peut noter un MV à `7.5`, revenir le lendemain, voir sa note initialisée à `7.5`, la changer à `8.0`, et le DB reflète immédiatement la nouvelle valeur (pas de doublon).

## 1.3 Impact sur l'algorithme "of the month"

L'échelle change de `[1, 10]` à `[0, 10]`. La formule bayésienne reste valable, mais :

- Recalculer la moyenne globale `C` sur la nouvelle échelle (sera légèrement plus basse car certains items vont récolter des 0)
- Le seuil `m` peut nécessiter un ajustement à la marge (à observer après quelques semaines de données réelles)
- Vérifier qu'aucune contrainte SQL ne bloque la valeur 0 (`CHECK (value >= 1)` éventuel à modifier en `CHECK (value >= 0)`)

---

# Section 2 — Performance globale

**Problème** : tout est ressenti comme lent — clics de filtre, changement de page, interactions diverses.

## 2.1 Audit obligatoire avant optimisation

**Ne pas optimiser à l'aveugle.** Avant de toucher au code :

1. **Lighthouse audit** sur `/upcoming`, `/calendar`, `/mvs`, `/groups`, page artiste — noter les scores Performance, FCP, LCP, TBT, CLS
2. **Chrome DevTools Performance** : enregistrer une session "click sur filtre" et identifier les composants qui re-render
3. **React DevTools Profiler** : identifier les composants qui re-render à chaque clic sans raison
4. **Network tab** : identifier les requêtes lentes ou redondantes
5. **`@next/bundle-analyzer`** : identifier les dépendances lourdes

Documenter les findings dans `docs/PERFORMANCE_AUDIT.md` **avant** de coder les fixes. Sinon on optimise à l'aveugle.

## 2.2 Optimisations côté serveur (RSC, queries, cache)

À vérifier/appliquer selon les findings de l'audit :

- **React Server Components** : maximiser leur usage, ne pas convertir en client components ce qui n'a pas besoin d'interactivité
- **Suspense boundaries** : streamer les sections indépendantes (la liste d'events ne doit pas bloquer le rendu des blocs latéraux)
- **Next.js caching** :
  - `revalidate` sur les fetch SSR (ex: liste des groupes : `revalidate: 3600` car ça change rarement)
  - `unstable_cache` sur les fonctions de query Supabase fréquentes
- **Queries Supabase** :
  - `select()` ciblé (ne pas récupérer des colonnes inutiles, surtout pas `image_url` quand on n'en a pas besoin)
  - Pagination serveur (`range()`) au lieu de tout charger puis filtrer client
  - Indexes DB sur les colonnes filtrées (`event.start_at`, `event.group_id`, `event.type`, `comment.created_at`, etc.)
  - Éviter les `N+1` (utiliser `select()` avec relations Supabase)

## 2.3 Optimisations côté client

- **Memoization** :
  - `React.memo` sur les composants de card lourds (EventBanner, MVCard, GroupCard)
  - `useMemo` sur les listes filtrées
  - `useCallback` sur les handlers passés en props
- **Debounce** sur tous les inputs de recherche/filtre (300ms par défaut, 100ms si UX fluide souhaitée)
- **Virtualization** : pour toute liste > 50 items, utiliser `@tanstack/react-virtual` ou `react-window`
- **Lazy loading** :
  - Images : `next/image` avec `loading="lazy"` partout (sauf hero/above-the-fold)
  - Composants lourds : `dynamic()` de Next.js pour les modales et widgets secondaires
- **Prefetch** : `<Link prefetch>` pour les routes principales (déjà default sur Next.js, vérifier que pas désactivé)

## 2.4 Bundle size

- Lancer `npm run build` + `@next/bundle-analyzer`
- Identifier les dépendances qui pèsent > 50 KB et chercher des alternatives plus légères
- Cibles classiques à surveiller :
  - `moment.js` → remplacer par `date-fns` ou `dayjs` (10x plus léger)
  - `lodash` → importer fonction par fonction (`import debounce from 'lodash/debounce'`) ou remplacer par natif
  - Icônes : importer une par une (`import { Heart } from 'lucide-react'`), jamais le pack entier

## 2.5 Critères d'acceptation performance

Cibles concrètes à atteindre :

- **Lighthouse Performance** : ≥ 85 sur mobile, ≥ 95 sur desktop
- **FCP** (First Contentful Paint) < 1.5s
- **LCP** (Largest Contentful Paint) < 2.5s
- **TBT** (Total Blocking Time) < 200ms
- **Click filtre → résultat visible** : < 200ms (perception "instantanée")
- **Navigation entre pages** : < 500ms (perception "fluide")

Si ces cibles ne sont pas atteintes après les optimisations, faire une seconde passe d'audit ciblée.

---

# Section 3 — Page MVs

## 3.1 Drag-to-scroll : étendre le drag aux cards elles-mêmes

> ✅ **FAIT (2026-06-09, `feat/quick-polish`)** : confirmé cassé (drag 250px → 20px puis blocage : le **drag natif de l'image/lien** préemptait le geste). Corrigé via `draggable=false` + `onDragStart preventDefault` + `select-none` + `preventDefault` au pointerdown souris.

**Problème actuel** : le drag-to-scroll ne marche qu'en cliquant **entre** les vidéos, ce qui laisse très peu d'espace (les cards remplissent presque tout). Il faut pouvoir drag en cliquant **sur** une card aussi.

**Solution** :

- Implémenter le drag au niveau du **conteneur parent** (pas sur chaque card)
- Différencier clic vs drag avec un **seuil de mouvement de 5 pixels** :
  - `pointerdown` → mémoriser `startX`, `startY`, `startTime`
  - `pointermove` → si delta > 5px : activer le mode drag (changer cursor, désactiver le clic sur les cards)
  - `pointerup` :
    - Si delta < 5px ET durée < 300ms → **clic** : naviguer vers le MV
    - Sinon → **drag terminé** : ne pas naviguer
- Pendant le drag : `cursor: grabbing` sur tout le conteneur, `user-select: none`
- Préserver le scroll natif (trackpad / wheel) en parallèle

**Critère d'acceptation** : cliquer-glisser sur une card de MV fait défiler la liste sans naviguer vers la page MV. Cliquer brièvement sur une card (sans glisser) navigue vers la page MV. Aucun "clic fantôme" après un drag.

## 3.2 Bandeau visuel par groupe

**Problème** : la page MVs est trop neutre, manque d'identité visuelle.

**Refonte** :

- Pour chaque section "From [Group]" dans "From your groups", ajouter un **bandeau d'en-tête** :
  - **Image du groupe** en background (depuis `Group.image_url`), avec léger flou ou overlay sombre pour la lisibilité
  - **Logo / nom du groupe** en grand par-dessus
  - **Couleur d'accent du groupe** (depuis `Group.color_hex`) appliquée subtilement (bordure, gradient, glow)
  - Hauteur du bandeau : modeste (60-80px), ne doit pas dominer la page
- Pour la section "Latest MVs (Global)" : un bandeau plus générique (logo KStage + titre)
- Cohérence : mêmes proportions et style pour tous les bandeaux

**Critère d'acceptation** : la page MVs a une identité visuelle forte, chaque section est immédiatement identifiable au coup d'œil, sans dominer le contenu (les vidéos restent les éléments principaux).

---

# Section 4 — Qualité du scraping MV

## 4.1 Filtre "MV officiels uniquement"

**Problème** : la liste des "Recent comebacks" contient des vidéos qui ne sont **pas** des MV officiels — teasers, lyric videos, dance practices, "out now" promotionnels, etc.

### Logique de détection à implémenter

Une vidéo est considérée comme **MV officiel** si **TOUTES** les conditions sont remplies :

**1. Whitelist titre** — Le titre doit contenir au moins une de ces expressions (case-insensitive, mots entiers) :

- `MV`
- `M/V`
- `Official Music Video`
- `Music Video`

**2. Blacklist titre** — Le titre ne doit contenir **AUCUNE** de ces expressions :

- `Teaser`
- `Trailer`
- `Out Now`
- `Lyric` / `Lyrics`
- `Audio`
- `Performance`
- `Behind`
- `Making`
- `Dance Practice`
- `Dance Cover`
- `Choreography`
- `Special Video`
- `Special Clip`
- `Reaction`
- `Live`
- `Concert`
- `Stage`
- `Showcase`
- `Inkigayo` / `Music Bank` / `Music Core` / `Show Champion` / `M Countdown` / `The Show`
- `Performance Video`
- `Practice Video`

**3. Uploader vérifié** — La vidéo doit avoir été uploadée depuis **l'une des chaînes YouTube officielles liées au groupe** (cf. §4.2).

### Implémentation

- Module `lib/scrapers/youtube/is-official-mv.ts` exposant `isOfficialMV(video, group): boolean`
- Tests unitaires sur ce module avec un panel d'exemples réels (au moins 20 cas positifs et 20 négatifs)
- Logger en DB (`scrape_log`) les vidéos rejetées avec la raison du rejet, pour audit ultérieur

**Critère d'acceptation** : sur un échantillon de 50 vidéos récentes des 4 groupes MVP, le filtre identifie correctement les MV officiels (zero faux positif, et reconnaît ≥ 95% des vrais MV officiels).

## 4.2 Support multi-chaînes YouTube par groupe

**Problème critique** : certains groupes ne publient pas leurs MV sur leur propre chaîne YouTube mais sur celle de leur agence. Exemple : (G)I-DLE publie sur la chaîne (G)I-DLE **ET** sur la chaîne Cube Entertainment. ILLIT publie via HYBE LABELS. BABYMONSTER via YG.

### Changement de schéma DB

Migrer `Group.youtube_channel_id` (single string) vers `Group.youtube_channel_ids` (array de strings).

```sql
ALTER TABLE "group"
  ADD COLUMN youtube_channel_ids TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "group"
  SET youtube_channel_ids = ARRAY[youtube_channel_id]
  WHERE youtube_channel_id IS NOT NULL;

ALTER TABLE "group" DROP COLUMN youtube_channel_id;
```

(Vérifier le nom exact de la table, c'est probablement `groups` ou `group`.)

### Identification des chaînes officielles par groupe MVP

À renseigner manuellement pour les 4 groupes au lancement :

- **aespa** : chaîne aespa + chaîne SMTOWN
- **ILLIT** : chaîne ILLIT + chaîne HYBE LABELS
- **BABYMONSTER** : chaîne BABYMONSTER + chaîne YG Entertainment
- **(G)I-DLE** : chaîne (G)I-DLE + chaîne Cube Entertainment

À élargir au reste des groupes scrapés (cf. §4.3).

### Logique de scraping

- Pour chaque groupe : récupérer les uploads récents **de toutes** les chaînes listées dans `youtube_channel_ids`
- Pour chaque vidéo récupérée : appliquer le filtre §4.1 (whitelist + blacklist + uploader vérifié)
- **Important** : filtrer aussi par mention du nom du groupe dans le titre, pour éviter qu'un MV d'IVE (publié sur Starship qui est aussi l'agence d'autres groupes) ne soit attribué au mauvais groupe
- Dédupliquer : si la même vidéo apparaît sur deux chaînes (rare mais possible), ne la stocker qu'une fois

## 4.3 Élargissement du scope au-delà des 4 groupes MVP

**Cible** : tous les groupes/artistes en DB avec **≥ 100k followers Spotify**.

### Seuil configurable

Variable d'environnement : `SCRAPING_MIN_SPOTIFY_FOLLOWERS=100000` (default 100k, ajustable).

### Pipeline

1. Cron quotidien : récupérer la liste des groupes en DB où `spotify_followers >= ENV.SCRAPING_MIN_SPOTIFY_FOLLOWERS`
2. Pour chaque groupe :
   - Vérifier que `youtube_channel_ids` est renseigné (sinon : log avertissement, skip)
   - Lancer le scraping YouTube sur toutes les chaînes liées
   - Appliquer le filtre §4.1
   - Insérer les nouveaux MV en DB
3. Logger les stats : nombre de groupes scrapés, nombre de MV ajoutés, durée totale, quota YouTube API consommé

### Quota YouTube API

L'API YouTube Data v3 a un quota de **10 000 unités/jour**. Un fetch d'uploads d'une chaîne coûte ~3-5 unités. À 100k followers, on a probablement 100-300 groupes éligibles → ~1 000-3 000 unités/jour, dans les limites confortables.

**Si on dépasse le quota** : prévoir un mécanisme de batching sur plusieurs jours (priorité aux groupes très suivis sur KStage en cas de saturation).

---

# Section 5 — Bug bias / images de membres

## 5.1 Problème

À la sélection de bias dans le profil, les images des membres sont soit **inexistantes** soit **cassées** (404).

## 5.2 Cause

Spotify API ne fournit pas d'images individuelles des membres d'un groupe (uniquement l'image du groupe entier ou de l'artiste solo). Les membres en DB n'ont donc pas d'`image_url` valide, sauf si renseignée manuellement.

## 5.3 Solution : pipeline scraping images membres

### Sources par ordre de priorité

1. **kpopping.com** — source principale
   - Chaque membre a une page dédiée avec photos récentes
   - URL pattern : `https://www.kpopping.com/profiles/idol/[name]`
   - Scraping de l'image principale (la plus récente affichée sur la page)
   - Avantage : agrégateur stable, base de données complète
2. **Fandom wikis** — source secondaire (fallback)
   - Wiki par groupe (ex: `kpop.fandom.com/wiki/[Group_Name]`)
   - Image principale de la page membre
   - Variable selon le groupe (certains wikis sont à jour, d'autres pas)
3. **Namu.wiki** — source tertiaire (fallback ultime)
   - Wiki coréen très complet mais structure HTML changeante
   - URL pattern : `https://namu.wiki/w/[Member_Name]` (avec gestion des caractères coréens)

### Implémentation

- Module `lib/scrapers/member-images/`:
  - `kpopping.ts` — scraper kpopping
  - `fandom.ts` — scraper fandom
  - `namuwiki.ts` — scraper namu
  - `index.ts` — orchestrateur avec fallback
- Cron hebdomadaire (les images ne changent pas tous les jours)
- Pour chaque membre : tenter source 1, si échec ou pas d'image → source 2, etc.
- Stocker l'image récupérée :
  - Soit upload vers Supabase Storage (recommandé, contrôle total, évite les hot-linking)
  - Soit stocker l'URL externe en DB (plus simple mais fragile si la source supprime l'image)
- Tracer la source utilisée : champ `Member.image_source` (`kpopping` | `fandom` | `namuwiki` | `manual`)

### Fallback ultime : avatar initiales

Si **aucune** source ne fournit d'image :

- Afficher un avatar généré : initiales du membre (1-2 lettres) sur fond coloré
- Couleur de fond : `Group.color_hex` du groupe du membre, ou hash du nom pour cohérence
- Composant : peut s'appuyer sur `shadcn/ui Avatar` avec `AvatarFallback`

**Critère d'acceptation** : à la sélection de bias, 100% des membres ont une image visible (vraie photo ou avatar fallback). Aucun 404, aucune image cassée. Les images les plus récentes sont privilégiées (pas d'images de plusieurs ères en arrière).

---

# Section 6 — Icônes des plateformes (rappel)

> ✅ **FAIT (2026-06-09, `feat/quick-polish`)** : icônes en **couleur de marque en thème clair**, muted-foreground (visible) en **thème sombre**, hover = marque dans les deux. Remplace la version grisée précédente (Fixes §6.3) à la demande de Rudy.

⚠️ **Si déjà traité par le doc `KSTAGE_FIXES_AND_POLISH.md` §6.3**, ignorer cette section.

Sinon : rappel des couleurs de marque à appliquer aux icônes sur les pages artiste :

- Twitter/X : noir (#000)
- Instagram : gradient (#E4405F → #FCAF45) ou rose principal (#E4405F)
- TikTok : noir avec accents cyan (#00F2EA) et rose (#FE2C55)
- YouTube : rouge (#FF0000)
- Spotify : vert (#1DB954)
- Apple Music : rose/rouge (#FA2D48)
- Deezer : violet/rose (#A238FF → #EF5466)
- Weverse : violet (#7B2CFF)

Stocker dans `lib/constants/brand-colors.ts`.

---

# Section 7 — Anniversaires comme events

## 7.1 Problème

> 🟡 **PARTIELLEMENT FAIT (2026-06-09, `feat/quick-polish`)** : les anniversaires (birthdays) sont générés à la volée (`src/lib/events/anniversaries.ts`) et étaient déjà sur la home. Symptômes Rudy corrigés : désormais **affichés sur `/calendar`** + **comptés dans « My groups · N upcoming »**. **Reste** : pages groupe/artiste, et anniversaires de **debut** (volontairement désactivés — à réactiver si voulu).

Les anniversaires (debut date des groupes, birthdays des membres) ne sont **pas comptés comme des events** dans l'affichage actuel. Ils n'apparaissent ni sur Upcoming, ni sur Calendar, ni sur les pages artiste.

## 7.2 Investigation

Causes possibles à vérifier :

1. **Type non géré** : `EventType.ANNIVERSARY` existe-t-il dans l'enum ? Si oui, est-il bien inclus dans les filtres de query ?
2. **Génération manquante** : les anniversaires sont-ils **insérés** comme events dans la table `Event` ? Si non, il faut un job qui génère un event "Anniversary" récurrent chaque année pour chaque groupe/membre.
3. **Filtres UI** : le filtre par type inclut-il `ANNIVERSARY` ? Le bloc Filters le propose-t-il dans la liste ?

## 7.3 Solution attendue

### Génération automatique d'events anniversary

- Cron quotidien (ou job au démarrage) :
  - Pour chaque groupe : générer un event annuel à la date `debut_date` (avec l'année en cours), si pas déjà présent
  - Pour chaque membre : générer un event annuel à la date `birthday`
  - Type : `EventType.ANNIVERSARY`
  - Titre : `[Group] - X-year debut anniversary` ou `[Member] birthday`
- Idempotent : ne pas créer de doublon si l'event existe déjà pour l'année en cours

### Affichage uniforme

- Anniversaires affichés dans Upcoming comme n'importe quel event
- Visibles dans Calendar avec leur couleur (à définir : jaune dans le mapping §2.1 du doc Fixes)
- Bannière sur Upcoming : tag "Anniversary", lien vers la page artiste (déjà spécifié dans le mapping §4 du doc Fixes)
- Inclus dans le filtre par type d'event

**Critère d'acceptation** : un anniversary d'un groupe suivi par l'user apparaît dans sa vue Upcoming avec ≥ 7 jours d'avance, le filtre permet de masquer/afficher les anniversaires, et la couleur est cohérente partout.

---

# Section 8 — Concerts : récupération multi-source et normalisation

## 8.1 Architecture 3 sources

Pour chaque concert d'un groupe scrapé, tenter les sources dans cet ordre :

| Priorité | Source                                                                    | Avantages                                                         | Inconvénients                                            |
| -------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| **1**    | **Bandsintown API**                                                       | Gratuite, dédiée concerts, par artiste, dates + venues structurés | Couverture variable pour le kpop, certains tours absents |
| **2**    | **Songkick API**                                                          | Bonne couverture, dates structurées                               | Quota strict (60 req/min), nécessite clé API             |
| **3**    | **Scraping comptes Twitter officiels du groupe + comptes "tour updates"** | Très à jour, signaux récents                                      | Fragile, demande parsing du texte/images                 |

### Implémentation

- Module `lib/scrapers/concerts/`:
  - `bandsintown.ts`
  - `songkick.ts`
  - `twitter.ts`
  - `index.ts` — orchestrateur avec fallback
- Pour chaque artiste : tenter source 1 → si pas de data ou erreur → source 2 → source 3
- Fusion intelligente : si plusieurs sources renvoient le même concert (matching sur date + ville), garder la donnée de la source la plus fiable, compléter avec le reste
- Trace : champ `Event.source` (`bandsintown` | `songkick` | `twitter` | `manual` | etc.)

## 8.2 Normalisation des titres de concerts

**Problème** : les titres scrapés sont verbeux et contiennent souvent des infos redondantes.

Exemples actuels :

- `2026-27 BABYMONSTER WORLD TOUR [춤 (CHOOM)] IN ASIA & OCEANIA`
- `WORLD TOUR [춤 (CHOOM)] - SEOUL`

**Refonte** : on connaît déjà le **groupe** (via le `group_id` de l'event) et la **date** (via `start_at`). Dans le titre affiché, il faut donc **uniquement** :

- Nom de la tournée (ex: `WORLD TOUR [춤 (CHOOM)]`)
- Ville / lieu (ex: `Seoul`, `Paris - Accor Arena`)

### Stratégie de parsing

À l'ingestion d'un event concert, **extraire ces 2 informations** :

1. **Nom de la tournée** : pattern à détecter dans le titre brut
   - Mots-clés : `WORLD TOUR`, `TOUR`, `CONCERT`, `FAN MEETING`, `FANMEETING`, `SHOWCASE`
   - Capturer entre crochets si présents : `[XXX]`, `〔XXX〕`
   - Nettoyer : retirer le nom du groupe, les années, les régions
2. **Lieu** : depuis le champ structuré de la source (Bandsintown/Songkick donnent `venue.name` + `venue.city` + `venue.country`)
   - Format affiché : `City - Venue Name` ou juste `City` si pas de venue
   - Si lieu non extractible : laisser vide (mieux que d'avoir une string mal parsée)

### Affichage final

Sur une bannière ou un event card :

- Tag : `Concert`
- Groupe : `BABYMONSTER`
- Titre : `WORLD TOUR [CHOOM] — Seoul, Olympic Hall`
- Date : `26 Jun 2026, 19:00 KST`

**Critère d'acceptation** : sur les 20 derniers concerts scrapés des groupes MVP, 100% ont un titre lisible "nom du tour + lieu", sans redondance avec le nom du groupe ou la date.

---

# Section 9 — Architecture multi-source globale

## 9.1 Principe général

Pour **chaque type de data critique**, formaliser une chaîne de sources :

| Type de data        | Source 1 (principale)                        | Source 2 (secondaire)                  | Source 3 (tertiaire)      |
| ------------------- | -------------------------------------------- | -------------------------------------- | ------------------------- |
| **Comebacks**       | dbkpop.com                                   | YouTube Data API (chaînes officielles) | Comptes Twitter officiels |
| **Music shows**     | liveshowupdatess.carrd.co                    | Sites officiels (Mnet, KBS, MBC, SBS)  | Twitter shows officiels   |
| **Lives**           | YouTube Data API (premieres)                 | Weverse (scraping)                     | Comptes Twitter officiels |
| **Anniversaires**   | Saisie manuelle (debut_date, birthday en DB) | —                                      | —                         |
| **Concerts**        | Bandsintown API                              | Songkick API                           | Scraping Twitter officiel |
| **Images groupes**  | Spotify API                                  | Comptes Twitter officiels              | kpopping.com              |
| **Images membres**  | kpopping.com                                 | Fandom wikis                           | namu.wiki                 |
| **Données artiste** | Spotify API                                  | kpopping.com                           | MusicBrainz               |

## 9.2 Implémentation du pattern

Chaque pipeline suit le même pattern :

```ts
async function fetchData<T>(target: Target): Promise<DataResult<T>> {
  for (const source of orderedSources) {
    try {
      const data = await source.fetch(target)
      if (isValid(data)) {
        await logSource(target, source.name, 'success')
        return { data, source: source.name, confidence: source.priority }
      }
    } catch (err) {
      await logSource(target, source.name, 'failed', err.message)
      // continue to next source
    }
  }
  return { data: null, source: null, confidence: null }
}
```

## 9.3 Table de traçabilité

Toutes les data insérées doivent garder une trace de leur source :

- Ajouter `source TEXT NOT NULL` et `source_priority INT` à chaque table data (Event, MV, Member, etc.)
- Si une source plus prioritaire fournit plus tard la même data → override des sources inférieures (avec log)
- Permettre le `source = 'manual'` (override admin) qui **n'est jamais écrasé** par les scrapers

## 9.4 Monitoring

- Dashboard admin : pourcentage de data par source, taux d'échec par source, dernière exécution par scraper
- Alerte si une source 1 échoue plus de 24h consécutives (signal que la source a changé / est down)
- Métriques exposées dans une page `/admin/scraping`

**Critère d'acceptation** : pour chaque type de data, le système tente automatiquement les sources dans l'ordre, log chaque tentative, et permet à l'admin de visualiser quelle source alimente quoi.

---

# Récap des conventions de travail

- Respecter les règles du `CLAUDE.md` (Partie A)
- Sections traitées **dans l'ordre suggéré**, sauf si une dépendance impose autrement
- Pour la Section 2 (performance) : **audit obligatoire avant fix**, documenté dans `docs/PERFORMANCE_AUDIT.md`
- Pour la Section 4.2 (multi-chaînes) : passer par une migration SQL versionnée
- Tester localement, puis sur Vercel preview, puis merger
- Si un point bloque (ex: source qui change de structure), documenter dans `docs/SCRAPING_NOTES.md` et lever l'alerte avant de patcher en urgence

---

# Hors scope (pour mémoire)

- Pipeline d'images individuelles **pour tous les solistes** (au-delà des membres de groupes) : Spotify peut le faire pour les solistes, donc pas nécessaire de scraper
- Système de votes pondéré par "fidélité de l'user" (V2)
- Affichage en temps réel du nombre de votes en cours sur un MV (V2)
- Détection automatique des nouvelles tournées via Twitter (V2)
