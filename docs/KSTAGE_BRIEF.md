# KStage — Brief projet (handoff)

> Document **autoportant** destiné à une lecture à froid (ex. une autre session/agent qui découvre le projet).
> Il résume : ce qu'est KStage, ce qu'on a construit, ce qu'on a appris, les erreurs commises, ce qu'on cherche à faire, et nos inspirations.
> Pour le détail vivant : `docs/PROJECT.md` (produit/technique), `docs/SCRAPING.md` (scrapers), `docs/AUDIT_UX_2026-06.md` (north-star rétention), `CLAUDE.md` (règles de travail).
> Daté du 2026-06-11, **mis à jour le 2026-06-12** après l'audit complet du projet (`docs/AUDIT_PROJET_2026-06-12.md` — constats vérifiés en prod) et la décision de direction qui en découle (cf. §4). App en prod : https://kstage.vercel.app/

---

## 1. C'est quoi KStage, en une phrase

**« Google Calendar conçu pour les fans de k-pop »** : une PWA mobile-first où le fan suit ses groupes favoris, et l'app filtre tout le reste, lui montre les événements à venir (sorties, MVs, music shows, anniversaires de membres et de début) et le notifie au bon moment dans son fuseau horaire.

**Ce que ce n'est PAS** : une encyclopédie (kprofiles), un média éditorial chargé (kpopping), une liste statique de comebacks (dbkpop). KStage est un **outil personnel**, pas une base de données globale qu'on parcourt.

### Public cible

Fans k-pop occidentaux, **principalement mobile**, marché niche mais passionné. UI en anglais (standard du fandom international), même si le dev et le pilotage produit se font en français.

### Différenciateur unique (l'angle gagnant)

**La notation /10 + commentaires par comeback/MV** — un « Letterboxd du k-pop ». Personne ne sert ce territoire nativement : la critique k-pop n'existe que sur des blogs solo (The Bias List, KPOPREVIEWED) ou sur RateYourMusic (non lié à un calendrier). KStage est le seul à pouvoir faire **« noter + discuter chaque sortie, ancré à un calendrier perso »**.

> ⚠️ Nuance (audit 2026-06-12) : le contenu-**objet** (les events) pré-existe grâce au scraping — aucune page n'est morte — mais le contenu **communautaire** (notes/commentaires) reste à amorcer (1 note sur 108 pages MV en prod). L'UI masque déjà correctement le vide (pas de « 0/10 » affiché, CTA « Be the first »). Conséquence de positionnement : le pitch jour-1 est le **calendrier + push** ; les ratings sont un **pari de rétention activable post-audience**, pas le différenciateur mis en avant tant qu'il n'y a pas de masse critique.

---

## 2. La vision (l'étoile polaire)

### Court terme — le calendrier perso

Le MVP est le cœur : un calendrier personnalisé **utile dès le jour 1 sans aucun contributeur**. C'est la donnée structurée (le schedule) qui crée l'usage quotidien.

### Long terme — plateforme communautaire (modèle HLTV / rft.gg)

Le cap V2 suit le pattern de **hltv.org** et **rft.gg** : un **cœur de données structurées** (schedule, stats, classements) crée l'usage quotidien, et une **communauté greffée sur les objets de données** (chaque match → sa discussion/ses votes) crée la rétention. **Le forum n'est jamais le point d'entrée — c'est la data qui attire, la commu qui retient.**

Mappé sur KStage : le **calendrier perso = le cœur de données**. La communauté se greffe sur chaque **comeback / MV** (sa note, son thread).

**Beachhead V2 (déjà amorcé)** : ratings + commentaires par MV, auto-ancrés aux events scrapés. **Différé (gaté sur trafic réel)** : forum généraliste, modérateurs bénévoles — un forum vide _dégraderait_ l'utilité du calendrier, à n'ouvrir qu'une fois une audience acquise.

### North-star opérationnelle actuelle : la RÉTENTION

L'audit UX de 2026-06 a tranché : le produit est **techniquement au-dessus du marché k-pop** mais **ne donne pas encore de raison forte de revenir**. Le risque n°1 d'un calendrier — **le vide** (à J0 et au retour) — est partout. La priorité produit est donc : **tuer le vide, créer des hooks de retour datés, capitaliser sur le différenciateur communautaire**. (Scorecard rétention : 2.5/5 actuel → cible 4.5.)

---

## 3. Ce qu'on a construit (état au 2026-06-11)

**MVP complet + V2 communautaire amorcée + première vague de rétention livrée.** Tout est en prod.

### Pages live

`/` (home : déconnecté = landing ; connecté = layout 3 colonnes), `/calendar` (feed-style cards), `/mvs`, `/mv/[slug]` (embed YouTube + note /10 + commentaires Reddit-style), `/groups` (+ tab Solo), `/groups/[slug]` (Members + Former), `/artists/[slug]` (avec parcours canonical), `/admin/suggestions`, `/admin/reports`. (`/my` n'existe pas — vérifié 404 en prod le 2026-06-12.)

### Données & scraping (opérationnels en prod)

- **Supabase `kstage`** (eu-west-3, free tier) : ~15 tables + RLS sur 100 % des tables users, seed étendu **173 groupes, 833 members, 42 solos**.
- **Sources auto actives** : YouTube Data API (premieres + MV, avec gate strict « MV officiels uniquement »), kpopofficial.com (comebacks), 6 music shows (carrd primary + fallbacks officiels par broadcaster : KBS Music Bank, MnetPlus M Countdown, imbc Music Core, SBS Inkigayo, SBS The Show, imbc Show Champion).
- **Spotify API** : images de groupes (100 % couvertes, re-vérifié 2026-06-12 : 173/173 mises à jour). ⚠️ La colonne `spotify_followers` est **inalimentable en l'état** (vérifié 2026-06-12) : Spotify ne renvoie plus `followers`/`popularity` aux apps client-credentials en mode développement (champ vide sur search et Get Artist, batch en 403). Restera NULL sauf extended quota Spotify — le ciblage « top groupes » se fait par liste manuelle ou subscribers YouTube (cf. `BACKLOG.md` P0.4/P0.5).
- **Idempotence** : contrainte `unique (group_id, type, start_at, source_url)` — protège du re-scrape de la même URL, **pas des doublons cross-chaînes** (même MV sur chaîne groupe + chaîne label = 2 lignes ; ~7 paires en prod, chantier P0 du backlog).

### Features livrées

- Auth Supabase (email/password + trigger `handle_new_user` qui crée le profile), follow/unfollow, vue « mes events », gestion timezone.
- **Notifications push** Web Push API + VAPID (**confirmé OK en prod**) : digest + **push datés par comeback** (announced / J-1 / jour-J, avec table d'idempotence `event_notifications`).
- **Notation slider [0,10] pas de 0.5** + commentaires threadés (votes +/-, tri top/new, soft-delete).
- **Countdown badges** sur les comebacks à venir, onboarding « follow d'abord », empty states actionnables, profil-vitrine de stats, bottom-nav mobile fixe.
- PWA installable (service worker maison pour le push ; Serwist/offline reporté).
- Suggestions communautaires + modération admin (allowlist `ADMIN_EMAILS`).
- SEO/OpenGraph, Vercel Analytics (RGPD-friendly), a11y (lint jsx-a11y, Lighthouse 100).

### Stack technique

- **Front** : Next.js 16 (App Router, **Turbopack**) + React 19 + TypeScript strict.
- **UI** : Tailwind CSS v4 + **shadcn/ui** style `base-nova` sur **Base UI** (`@base-ui/react`) — ⚠️ **PAS Radix**. Base UI utilise la prop `render`, pas `asChild`. Icônes `lucide-react` + `@icons-pack/react-simple-icons`.
- **Back/DB** : Supabase (Postgres + Auth + Storage + RLS).
- **Héberg.** : Vercel (Hobby). **Cron** : Vercel Cron (GET only, `Authorization: Bearer ${CRON_SECRET}`, limite **1×/jour** sur Hobby).
- **Scraping** : `cheerio` + fetch ; `r.jina.ai` comme proxy universel anti-bot quand nécessaire.
- **Tests** : Vitest (logique métier : parsing, timezone, idempotence) + Playwright (golden paths). Pragmatique, pas de TDD imposé. ~333 tests verts.

### Convention de travail

Une feature = une branche `feat/...` = un PR vers `main` (relecture forcée même en solo). Commits petits/atomiques. Migrations SQL versionnées (`supabase/migrations/0001..0030`), RLS écrite dans la **même** migration que la table.

---

## 4. Ce qu'on cherche à faire maintenant (direction 2026-06-12)

**Décision (Rudy, 2026-06-12, post-audit)** : pas de date de soft launch visée pour l'instant. Objectif = une **V1 assez bonne pour être fonctionnelle et retenir dès le premier utilisateur**. La roadmap active et détaillée vit dans **`docs/BACKLOG.md`** (réécrit le même jour). En résumé :

1. **P0 — Data** : tenir la promesse du calendrier. Nettoyage de la classification YouTube (bruit promo, concerts fantômes), dédup cross-chaînes, observabilité des crons (échecs aujourd'hui silencieux), réécriture quota (`playlistItems.list`), élargissement de la couverture aux ~30-50 groupes les plus suivis, alignement promesse/pipeline (entry points des groupes vides). _Constat moteur : 8 events futurs dans toute l'app, 82 % des groupes à zéro event (audit §2)._
2. **P1 — Quick wins vérifiés** : bouton Sign up cassé, SEO des 173 pages groupes, garde admin manquante sur `getOpenReports`, toggles Supabase, hygiène.
3. **P2 — Habitude (utile à n=1)** : digest hebdo, refonte landing/home.
4. **Gelé (gaté sur audience réelle)** : feed d'activité, RSVP/hype, **Wrapped**, forum. _Règle : une feature dont la valeur dépend du nombre d'utilisateurs attend une audience ; une feature utile à n=1 est éligible._

**Le soft launch** (Reddit r/kpop, Twitter) n'a jamais été fait — c'est volontaire désormais : il redeviendra le sujet quand la V1 tiendra sa promesse data. À garder en tête : la **rétention ne se mesure pas sans utilisateurs** ; d'ici là, la scorecard rétention de l'audit UX reste une heuristique, pas une métrique.

---

## 5. Nos inspirations

| Inspiration                             | Ce qu'on en tire                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **hltv.org / rft.gg**                   | Le modèle structurel : data structurée (cœur d'usage) + communauté greffée sur les objets de données. Forum jamais en point d'entrée.     |
| **Letterboxd**                          | Le différenciateur : noter/critiquer chaque sortie. Like léger découplé de la note. Feed d'activité, follow d'users, listes partageables. |
| **Bandsintown**                         | Push datés en 2 temps (annoncé + J-1/jour-J). RSVP « j'y vais » → preuve sociale.                                                         |
| **blip.kr / bestofkpop**                | Countdowns animés, cartes visuelles, push schedule. Concurrents k-pop directs sur le créneau « moderne ».                                 |
| **Spotify (Wrapped / Discover Weekly)** | Le rendez-vous récurrent + la rétro annuelle virale qui crée l'habitude et l'acquisition.                                                 |
| **MyAnimeList / Trakt**                 | Le profil = « CV de fan » qui capitalise l'investissement (nb suivis, notes, moyenne).                                                    |
| **Esthétique HLTV**                     | Direction de marque : **dense / dark / data-forward** (« outil sérieux »), différenciant face au visuel pastel/cutesy ambiant du k-pop.   |

**Garde-fou** : ne PAS chasser la gamification lourde de _blip_ ni le wiki de _kpopping_ (trop coûteux en solo). L'avantage = communauté de notation + exécution propre.

---

## 6. Ce qu'on a appris (leçons techniques)

- **Vercel Cron = GET uniquement**, jamais POST, et ajoute `Authorization: Bearer ${CRON_SECRET}` automatiquement. Une route cron POST-only n'est **jamais** déclenchée (bug latent réel rencontré). Limite Hobby : **1 cron/jour max** — rejeté au _deploy_, invisible en build local.
- **Next 16 tourne en Turbopack** → `@serwist/next` (webpack) ne s'applique pas. Pour du push pur, un service worker écrit à la main suffit ; precaching offline reporté.
- **`next/image` impose `remotePatterns`** : un host externe non whitelisté renvoie **HTTP 400** (image cassée). Le bug « images membres cassées » n'était pas un manque de data mais ça → fix `unoptimized` sur l'`Avatar`. **Leçon : vérifier le box réel dans le navigateur, pas le DOM ni les fixtures.**
- **PostgREST embed exige une FK directe** : `from(A).select('..., B(...)')` crashe en PGRST200 s'il n'y a pas de FK `A→B` (ex. `comments → profiles`). Solution : 2 queries séparées.
- **Préfixe `<img>` + flex item content-sized** : Preflight `max-width:100%` peut collapser la largeur à 0 → `max-w-none`.
- **`r.jina.ai/<URL>`** = proxy universel qui bypasse anti-bot/JS/coréen pour scraper à peu près n'importe quelle page (validé 8+ fois).
- **YouTube channel discovery** : oembed + Jina pour vérifier qu'une chaîne héberge bien les MV d'un artiste avant de la scraper.
- **Détection MV officiels** : whitelist titre (`MV`, `M/V`, `Official Music Video`) + blacklist (teaser, lyric, dance practice, performance…) + uploader vérifié. Gate **strict** assumé (sacrifie les versions Performance, gérées séparément).

---

## 7. Les erreurs commises (et ce qu'on en garde comme méthode)

- **Sur-spécifier avant de vérifier le réel.** Plusieurs sections de plan reposaient sur des hypothèses fausses : §4.2 « il faut une migration `youtube_channel_ids[]` » (faux, l'archi `sources` le faisait déjà) ; §5 « il manque les photos des membres » (faux, c'était un bug config `next/image`). **Leçon : valider l'état réel en prod (MCP Supabase / Playwright / curl) AVANT de planifier — pas après.**
- **Croire les tests verts plutôt que la prod.** Règle adoptée : ne jamais _claim_ qu'un affichage marche sans l'avoir vérifié en prod via MCP. « Tests verts » ≠ « ça marche ».
- **Sources de données mortes prises pour acquises.** dbkpop abandonné (404 depuis ~juillet 2025), Wikidata périmé, kpopping en anti-bot 403. **Leçon : vérifier qu'une source est vivante/à jour soi-même avant de la proposer.**
- **Scope creep récurrent.** §8 concerts (pas de source propre gratuite → abandonné), §9 archi multi-source + `/admin/scraping` (reporté). **Leçon : rester strict sur le besoin concret, pousser back sur la sur-modélisation DB et les abstractions spéculatives.**
- **PR qui se superposent.** Quand une PR de suivi est un sur-ensemble d'une autre, fermer l'obsolète plutôt que merger les deux.
- **Empilement de branches.** ~~100 branches `feat/*` traînaient~~ — purgées le 2026-06-12 (repo réduit à `main`).
- **Features communautaires lourdes livrées avant toute audience** (commentaires Reddit-style complets, 833 pages membres) pour 2 comptes en prod — sunk cost assumé, mais la leçon est actée dans la règle de gel du backlog : _une feature dont la valeur dépend du nombre d'utilisateurs attend une audience réelle._
- **Claims prod non vérifiés dans les docs.** Le brief lui-même affirmait `spotify_followers` peuplé (0/173 réel), « pas de doublons » (7 paires en prod) et listait `/my` (404) — en contradiction avec sa propre leçon « vérifier en prod avant de claim ». Règle : tout claim d'état prod dans un doc est **daté et sourcé** (requête SQL ou capture).

### Méthode de travail validée (cf. `CLAUDE.md`)

Réfléchir avant de coder (énoncer les hypothèses, contredire quand l'user se trompe) · simplicité d'abord (minimum de code, rien de spéculatif) · changements chirurgicaux (toucher uniquement ce qui est demandé) · exécution orientée objectif (critères de succès vérifiables) · **recherche profonde multi-outils/multi-agents avant d'implémenter, et vérifier en prod avant de claim**.

---

## 8. Pistes ouvertes pour qui reprend le projet

> ⚠️ Section remplacée le 2026-06-12 : la roadmap active est **`docs/BACKLOG.md`** (P0 data → P1 quick wins → P2 habitude → gelé). Ce qui reste vrai ici :

- **Élargir le scraping au-delà des 4 groupes MVP** — ⚠️ le plan initial sous-estimait le coût quota d'un facteur ~20-40 : le scraper actuel fait 2× `search.list` (200 units/source), pas du `playlistItems.list` (1 unit). **Prérequis** : réécrire sur `playlistItems.list` + quota tracking (BACKLOG P0.4) avant tout backfill. Le critère « ≥100k followers Spotify » dépend d'une colonne encore vide (0/173) — utiliser une liste manuelle des tops en attendant.
- **Digest hebdo « ta semaine k-pop »** — le hook d'habitude n°1 non livré (P2 ; n'a de valeur qu'après P0, sinon le digest est vide).
- **Soft launch** — volontairement sans date (décision 2026-06-12) ; redevient le sujet quand la V1 tient sa promesse data.

> Groupes MVP de référence (pipeline testée dessus) : **aespa** (SM), **ILLIT** (HYBE/Belift), **BABYMONSTER** (YG), **i-dle** (Cube) — mix volontaire de générations et d'agences.
