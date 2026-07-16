# PROJECT.md — KStage / K-Era

> Contexte produit & technique du projet. Le « comment coder » est dans `CLAUDE.md` (règles de comportement) ; ce fichier répond au « quoi coder » et « pourquoi ».

---

## 1. Vision

### Concept

Application web (PWA mobile-first) qui permet aux fans de k-pop de **suivre les events de leurs groupes favoris** dans un calendrier personnalisé, avec notifications push.

### Positionnement

**Outil personnel**, pas une base de données encyclopédique. Différenciation claire face aux concurrents :

- **kpopping** : média éditorial chargé, calendrier global non personnalisable
- **dbkpop** : liste statique de comebacks, pas de notifs ni filtrage
- **kprofiles** : wiki encyclopédique, pas un calendrier
- **biasroom** : photocards, hors sujet schedule

Angle : _"Google Calendar conçu pour les fans de k-pop"_ — tu suis tes groupes, l'app filtre tout le reste, te notifie au bon moment dans ton fuseau horaire.

### Public cible

Fans k-pop occidentaux, principalement mobile. Marché niche mais passionné. MVP francophone-friendly mais UI en anglais (standard du fandom international).

### Nom

**KStage** (verrouillé — plus K-Era). À utiliser dans le repo, `package.json`, le manifest, le domaine. Dispo des domaines à vérifier (`.app`, `.io` plus probables que `.com`).

---

## 2. Scope du MVP

### Groupes au lancement (4)

- **aespa** (SM Entertainment)
- **ILLIT** (HYBE / Belift Lab)
- **Babymonster** (YG Entertainment)
- **i-dle** (Cube Entertainment) — ex-(G)I-DLE, renommé en 2025

Choix volontaire : mix générations (3e/4e gen) et éditeurs (SM/HYBE/YG/Cube) pour tester la pipeline sur des écosystèmes différents.

### Types d'events couverts au lancement

1. **Releases** (albums, singles) — _essentiel_
2. **Music videos** — _essentiel_
3. **Music shows** (M Countdown, Music Bank, Show Champion, Inkigayo, Music Core, The Show) — _essentiel, gros volume hebdo_
4. **Anniversaires** (dates de début et anniversaires des membres)

Hors scope du lancement : événements live, concerts, fanmeetings, tournées, variety shows, award shows et sub-units. Le type interne live reste conservé pour les données historiques.

### Features MVP

- Liste/calendrier des events filtrables
- Auth utilisateur (email/password ou OAuth)
- Follow/unfollow groupes
- Vue personnalisée "mes events à venir"
- Notifications push (J-1, J-jour, custom)
- Gestion timezone utilisateur
- PWA installable, mode hors-ligne basique

### Modèle de contenu : hybride

- **80% automatisé** via scraping/APIs
- **20% communautaire** via suggestions utilisateurs validées en admin (modération asynchrone)
- L'app est **utile dès le jour 1 sans aucun user contributeur**

---

## 3. Stack technique

- **Frontend** : Next.js 16 (App Router) + TypeScript strict + React 19
- **Styling** : Tailwind CSS v4 + **shadcn/ui** (style `base-nova`, base `neutral` ; **Base UI** `@base-ui/react` dessous → a11y par défaut). ⚠️ Pas Radix — Base UI utilise la prop `render` (et non `asChild`).
- **Backend / DB** : Supabase (PostgreSQL + Auth + Storage + RLS)
- **Hébergement** : Vercel
- **PWA** : Serwist (`@serwist/next`) — fallback `next-pwa` si problèmes
- **Notifs push** : Web Push API + service worker
- **Cron/scraping** : Vercel Cron (primaire) ou GitHub Actions (fallback) — voir §5
- **Tests** : Vitest (logique métier) + Playwright (golden paths) — pragmatique, pas de TDD imposé
- **Repo** : GitHub (privé au début, public à la sortie MVP éventuellement)

### Notes PWA

- Manifest + service worker + Web Push API
- iOS : notifs push uniquement depuis iOS 16.4+ et seulement si app "installée" sur l'écran d'accueil → bien guider les users iPhone à l'install
- **Service worker (étape 6)** : SW minuscule écrit à la main (`public/sw.js`, listeners `push`/`notificationclick`), servi statiquement → aucune intégration build. Next 16 build/dev en **Turbopack**, donc `@serwist/next` (webpack) ne s'applique pas et imposerait `@serwist/turbopack`. Serwist (precaching offline) **reporté à l'étape 9** quand on fera vraiment l'offline.

> Spécifique Next.js 16 : voir `AGENTS.md` (breaking changes, lire `node_modules/next/dist/docs/` avant d'écrire une API Next inconnue).

---

## 4. Modèle de base de données

8 tables core (migrations `supabase/migrations/0001_init.sql` + `0002_rls.sql`) :

```
groups (id, slug, name, agency, fandom_name, debut_date, color_hex, image_url, created_at)
members (id, group_id, stage_name, real_name, birthday, position, created_at)
events (id, group_id, type, title, description, start_at, end_at, status, source_id, source_url, image_url, ...)
sources (id, name, url, type, last_scraped_at, created_at)
user_follows (user_id, group_id, created_at)
user_notification_settings (id, user_id, event_type, lead_time_minutes, channel, enabled)
event_suggestions (id, user_id, group_id, type, title, start_at, status, reviewed_by, reviewed_at, ...)
push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at)

Enums : event_type (mv | release | music_show | live | anniversary | concert | other)
        event_status (confirmed | tentative | cancelled)
        suggestion_status (pending | approved | rejected)
```

**Idempotence** : `events` a une contrainte `unique (group_id, type, start_at, source_url)` pour empêcher le scraping de créer des doublons.

**Principe** : commencer simple, étendre seulement quand un besoin concret apparaît. Pas de sur-modélisation (sub-units, parent companies, etc.) tant que pas nécessaire.

**Sémantique des dates (contrat produit, Phase 0)** — 3 états, à respecter à l'affichage ET aux notifications :

- **Date + heure exactes** (`status='confirmed'` avec une heure réelle) : D-day + heure locale + countdown minute autorisés.
- **Date connue, heure TBA** : jour confirmé sans heure publiée → afficher « Date confirmed · time TBA », pas de countdown minute, pas de push minute-précis.
- **Tentative** (`status='tentative'`) : la row porte une **heure technique = minuit KST** (`kstToUtcISO` défaut 00:00) qui NE DOIT PAS être présentée comme exacte → même traitement que « heure TBA ».

> Ici on pose la **définition** ; l'implémentation honnête (masquer l'heure fictive d'un `tentative`, supprimer le countdown minute) est un lot de la **Phase 1** (contrat de confiance).

**Niveaux de confiance (couverture graduée, roadmap Phase 3)** — définition posée en Phase 0, gate implémenté en Phase 3 :

- **Vérifié** : identité + sources confirmées, scraping récent → publié + éligible aux notifications.
- **Surveillé** : artiste légitime, couverture potentiellement partielle → publié (promesse limitée), notifie uniquement les données à forte confiance.
- **Candidat / pré-début** : détection automatique encore ambiguë → non publié (ou noindex), jamais de notification.

Principe : **découvrir largement, ne garantir que ce qui est vérifié.** L'auto-publication d'un nouveau debut est réservée aux cas à preuves fortes.

---

## 5. Sources de données

### Comebacks

- **YouTube Data API** (officielle, gratuite, quota suffisant) : surveille les chaînes officielles, capture les "Premieres" programmées avec date/heure exacte — **opérationnel (étape 5)**
- **kpopofficial.com** (scraping) : calendrier comeback mensuel, frais et précis (dates + heures KST), `robots.txt` permissif, couvre nos 4 groupes. Page par mois `/kpop-comeback-schedule-<mois>-<année>/` — **cible étape 7**
- **Comptes Twitter/X officiels** (backup, plus tard) : `@aespa_official`, `@ILLIT_official`, `@YG_BABYMONSTER`, `@G_I_DLE`

> ⚠️ **dbkpop.com abandonné** (vérifié 2026-05-26) : plus maintenu depuis ~juillet 2025, page "comeback calendar" en 404 — devenu une base statique de profils/MV. **kpopping.com** écarté aussi (`robots.txt` bloque ClaudeBot/GPTBot + 403 anti-bot).

### Music shows

- Sites officiels (mnetplus, KBS, SBS, MBC, SBS MTV, MBC M)
- Lineups annoncés mardi-mercredi pour la semaine
- Scraping nécessaire (pas d'API)

### Événements live — compatibilité historique

- Le type live reste lisible pour les anciennes données, mais n'est ni filtrable ni présenté comme une catégorie du lancement.
- Les métadonnées YouTube liveBroadcastContent et scheduledStartTime restent utilisées pour distinguer une premiere programmée d'une vidéo déjà publiée.
- Aucune ingestion Weverse Live n'est prévue pour la bêta.

### Anniversaires

- **Saisie manuelle** une fois (statique, ~30 dates pour les 4 groupes)
- Mise à jour si line-up change (rare)

### Stratégie scraping

- Cron 1-2× par jour, pas plus (respect des sites)
- Cache agressif côté DB
- Respect `robots.txt`
- Isoler chaque source dans son propre module pour réparer vite quand une structure change
- Logguer les erreurs (Sentry ou simple table `scrape_log`)
- Prévoir un fallback manuel quand une source casse

### Décision orchestration cron (2026-05-24)

**Vercel Cron** en primaire (zéro infra, déjà sur Vercel, route `/api/cron/*` protégée par `CRON_SECRET` ; limite Hobby ~1×/jour cohérente avec 1-2×/jour). **GitHub Actions** en fallback si fréquence plus fine (lineups music-shows mardi/mercredi) ou jobs longs. **n8n self-host écarté au MVP** : maintenance + surface de panne disproportionnées pour 2-3 scrapers (revient sur la table en V2+ si workflows nombreux/complexes).

> ⚠️ **Vercel Cron déclenche en GET uniquement** (jamais POST) et ajoute automatiquement l'en-tête `Authorization: Bearer ${CRON_SECRET}` quand la var d'env existe. Les routes `/api/cron/*` doivent donc exporter `GET`. Une route POST-only n'est jamais déclenchée par le cron.

---

## 6. Roadmap MVP

Étapes dans l'ordre, chaque étape produit quelque chose de testable. **Une étape = une branche `feat/...` = un PR vers `main`.**

1. **Setup projet** — Init Next.js + TS + Tailwind, repo GitHub, projet Supabase, Vercel, env vars. ✅ **DONE & mergé.**
2. **Modèle de données + seed manuel** — Migrations (8 tables core + RLS), seed 4 groupes + ~20 events, client Supabase typé. ✅ **DONE & mergé.**
3. **Frontend basique** — Page d'accueil (events à venir), page groupe, filtres groupe/type, vue calendrier mensuelle, design shadcn, dark mode, a11y. Retirer la page `/test`. ✅ **DONE & mergé.**
4. **Auth + Follow groupes** — Auth Supabase (email/password + OAuth Google bonus), table `user_follows` + UI, vue "mes events", gestion timezone. ✅ **DONE & mergé.**
5. **Première pipeline de scraping** — 1 source (YouTube Data API), API route protégée par token, Vercel Cron, logging + idempotence. ✅ **DONE & mergé** (PR #8).
6. **Notifications push** — Service worker + Web Push API, abonnement push, envoi serveur (cron digest quotidien), guide install iOS. ✅ **DONE & mergé** (PR #9 + #10). Reste ops : confirmer les 4 vars VAPID sur Vercel **Production**.
7. **Sources supplémentaires** — modules isolés :
   - **Comebacks** : scraping `kpopofficial.com`. ✅ **DONE & mergé** (PR #11 ; dbkpop abandonné, cf. §5).
   - **Music shows** : agrégateur + sources diffuseurs pour les 6 émissions suivies. ✅ **DONE & mergé.**
   - **Événements live (Weverse)** : retirés du scope du lancement ; compatibilité interne uniquement, sans promesse d'ingestion.
8. **Système de suggestions communautaires** — Form user (auth) → `event_suggestions`, interface admin valider/rejeter (→ insert `events`). Admin via allowlist `ADMIN_EMAILS` ; notif au contributeur **reportée** (statut visible sur `/my`). La contribution couvre les catégories du lancement ; les suggestions live restent rejetées par la validation. ✅ **DONE & mergé** (PR #12).
9. **Polish + lancement** — SEO/OpenGraph, landing marketing, analytics (Vercel Web Analytics, RGPD-friendly), PWA icônes brandées, redesign dark, audit a11y (Lighthouse 100). ✅ **Code mergé** (PR #13/#14/#15). Reste : **soft launch** (Reddit r/kpop, Twitter) — action produit, pas encore faite.

> Plans d'étape détaillés : `docs/plans/`.
>
> Au-delà du MVP : **vision V2 (plateforme communautaire) → §10**.

---

## 7. Pièges identifiés à éviter

- **Sur-modélisation de la DB** : pas de sub-units, agencies parents, etc. tant que pas nécessaire
- **Couvrir trop de groupes au lancement** : 4 c'est le bon nombre, étendre par demande user
- **Compter sur la communauté comme source principale** : c'est un bonus, pas le moteur (cold start)
- **Construire des notifs avant pipeline scraping stable** : pas de notif fiable sans data fiable
- **Burnout d'enthousiasme initial** : rythme soutenable > sprint qui s'éteint
- **Reporter le déploiement** : déployer dès l'étape 1 sur Vercel, même si c'est "Hello World"
- **Ignorer iOS pour la PWA** : tester l'install iPhone tôt, c'est là que les surprises arrivent

---

## 8. Profil du développeur

- Sortie de formation **OpenClassrooms — Développeur d'application web (RNCP niveau bac+3/4)**
- Stack principale apprise : **React / Next.js**
- Beaucoup de temps libre disponible
- Premier vrai projet perso d'envergure post-formation
- Objectif double : produit fonctionnel + portfolio pro
- **Préfère le tutoiement, réponses concises, paragraphes courts**
- **Veut être contredit quand il se trompe** plutôt que validé par défaut

---

## 9. État actuel

> **L'historique daté vit dans `docs/JOURNAL.md`** (journal de bord, une entrée par lot mergé). Ici : uniquement l'état courant, rafraîchi à chaque changement de phase/chiffres.

### État au 2026-07-15

> **Programme actif** : roadmap audit-driven 0→5 (détail daté dans `docs/JOURNAL.md`). **Phase 0 (vérité produit) faite** ; **Phase 1 (contrat de confiance) en cours** — Lots 1 (`hidden` partout), 2 (dates `tentative`), 3a (timezone par viewer) livrés ; restes 3a-polish / 3b (push-digest tz) / 4 (budget notifs) / 5 (monitoring).

**Phase** : MVP + V2 beachhead + Data Desk + roadmap R jusqu'à R3 + **opération « launchable » 2026-07-11** (audit multi-agents 6 dimensions → 8 lots mergés) — CI reverte (bug ICU `hourCycle`, rouge depuis le 17/06 sans que personne ne s'en aperçoive), cause racine doublons music_show soldée (`stage_url`, migration 0040 + index unique), photos membres nettoyées (14 fausses trouvées par l'audit) puis **self-hostées** (492/492 → bucket Storage `member-photos`), fixes UX (dialogs scrollables + X, échecs silencieux toastés, fin du **soft-404 global** — vrais 404), **a11y AA sur le thème par défaut** (`--faint` 5.1:1, ticker pausable, combobox ARIA), cohérence design (rayons tokens, cartes v1 soldées), **slots hebdo synthétiques des 6 shows** (« Lineup TBA », P0.8 tranché) + 4 groupes fantômes remplis (+41 MVs via chaînes labels vérifiées), perf (Promise.all home, ingest batché, policies 0041). Reste : boucle contribution admin (hors périmètre — décision Rudy « focus utilisateur final ») + actions Rudy (E2E_ENABLED + 4 secrets GitHub, sitemap Search Console). **Round 4 (2026-07-13)** : catalogues MV COMPLETS (+1 155, cause racine max-pages=12 soldée, §3.19), images à la source (Spotify by-ID + garde, bannières YT 2560px, photos membres fandom en rotation quotidienne — fini Weird Al sur WEi), rosters audités (32 formers, disbanded_on, 13 ajouts), feedback unifié (Idea/Bug/Data), fil commentaires léger, Drops « MV Desk », music shows durcis (fallback lineup maigre + alerte J-1 + solos de membres), **auto-découverte des debuts** (fandom + gate de notabilité + /admin/debuts). Roadmap : `docs/BACKLOG.md` · historique : `docs/JOURNAL.md` · risques : `docs/RISKS.md`.

**Chiffres prod** : **168 groupes** (~29 solistes après reclassement + debuts auto + 14 ajoutés R10), **0 groupe vide** (8 remblayés le 2026-07-14 dont 4 reclassés soliste→groupe : ADYA/ARrC/KISEO/SUCTION), **2 355 MVs** (catalogues pleine profondeur + 65 R11 via chaînes label), **864 membres dont 855 avec photo** (98,96 % ; 9 résiduels sans pageimage fandom), bannières YT 2560px, **544 tests unitaires + 28 E2E** (✅ job e2e GitHub **activé + vert** depuis le 2026-07-15 : variables montées au niveau repo + `ci.yml` lit `vars.*` ; run `78266ee` success. Reste conseillé : un compte test dédié — `E2E_AUTH_EMAIL` = compte perso de Rudy). **Tier premium neutralisé** (2026-07-14) : surface inerte retirée de l'UI, socle DB `profiles.tier` conservé pour un futur round Stripe. **Socle scraping activé** (R10.1) : crons GitHub Actions opérationnels (music-shows 2×/j, youtube, comebacks, images). App : https://kstage.vercel.app/

**Pages live** : `/` (landing / home 8 modules), `/calendar`, `/mvs`, `/mv/[slug]` (ratings + comments), `/groups` (+tab solo), `/groups/[slug]`, `/artists/[slug]`, `/search`, `/u/[username]`, `/account` (notifs par type + calendar feed), `/admin/*`, `/api/ical/[token]`.

**Stack livrée** : Next.js 16 (Turbopack) + React 19 + TS strict + Tailwind v4 + shadcn/Base UI ; Supabase (RLS 100 %) ; **crons via GitHub Actions** (`.github/workflows/crons.yml`, 7 schedules — Vercel Hobby plafonnait le nombre de crons) ; push Web Push complet ; CI lint/tsc/vitest/build + e2e prod-build.

**Reste produit (hors code)** : soft launch — pas de date (choix assumé). Actions Rudy en cours : soumettre le sitemap à Search Console, vérifier ses follows (incident E2E du 2026-07-05, cf. JOURNAL), compte E2E dédié un jour.

> ⚠️ E2E : ne **jamais** laisser un `npm run dev` ouvert pendant `npm run test:e2e` — Next 16 refuse un 2ᵉ serveur dev, ce qui fait échouer le `webServer` de Playwright.
> ⏳ Outillage : `gh` CLI inaccessible + MCP GitHub sans accès au repo → opérations GitHub (PRs, variables, secrets) via l'UI web.

---

## 10. Vision V2 — plateforme communautaire (étoile polaire)

> Cap long terme, **post-MVP**. Le MVP reste le calendrier perso (utile jour 1 sans aucun contributeur). On ne pivote pas maintenant.

### Modèle de référence : hltv.org / rft.gg

Les deux suivent le même pattern : un **cœur de données structurées** (schedule, stats, classements) qui crée l'usage quotidien, et une **communauté greffée sur les objets de données** (chaque match → sa discussion/ses votes). Le forum n'est jamais le point d'entrée — c'est la data qui attire, la commu qui retient.

**Mappé KStage** : le calendrier perso = le cœur de données. La communauté se grefferait sur chaque **comeback / MV**.

### Beachhead V2 (1ʳᵉ brique commu)

**Ratings + commentaires par comeback/MV**, auto-ancrés aux events déjà scrapés (chaque sortie = un thread de notation généré automatiquement).

- **Vrai gap marché** : la notation k-pop n'est servie que par des blogs solo (The Bias List, KPOPREVIEWED) ou RateYourMusic (non-natif, pas lié au calendrier). Personne ne fait « noter + discuter chaque sortie, ancré à un calendrier perso ».
- **Pas d'effet ghost-town** : le contenu (les events) pré-existe grâce au scraping → pas une page vide à amorcer.
- Modération légère vs un forum libre.

### Différé (gaté sur trafic réel)

Forum généraliste, votes topics/messages, **modérateurs bénévoles**. Raison : **cold-start** + incumbents qui possèdent les effets de réseau (Reddit r/kpop = déjà un forum k-pop voté ; Weverse ; apps de vote Choeaedol/Mubeat/Whosfan). Un forum vide **dégraderait** l'utilité du calendrier. À n'ouvrir qu'une fois une audience réelle acquise via le calendrier + ratings.

### Design

Inspiration **dense / dark / data-forward** (style « outil sérieux » à la HLTV), différenciant face au visuel pastel/cutesy ambiant du k-pop. Récupérable tôt comme angle de marque, avant même les features commu.
