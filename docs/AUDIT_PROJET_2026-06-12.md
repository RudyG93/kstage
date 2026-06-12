# KStage — Audit complet du projet (2026-06-12)

> **Méthode** : 8 audits indépendants (docs, architecture, sécurité, DB prod, UX prod, tests/build, scraping, produit) menés par agents spécialisés, puis **contre-vérification adversariale** des findings critical/high par des vérificateurs sceptiques indépendants (re-exécution SQL sur la prod, relecture du code, navigation Playwright sur https://kstage.vercel.app/). Les sévérités ci-dessous sont celles **après** contre-vérification — certains findings ont été dégradés ou réfutés, c'est signalé.
>
> **Légende statut** : ✅ confirmé par contre-vérification · ⚠️ confirmé mais sévérité corrigée · ❌ réfuté (gardé pour trace) · — non contre-vérifié (preuve directe citée).
>
> Ce document est le **référentiel des constats**. Le plan d'action qui en découle vit dans `docs/BACKLOG.md` (réécrit le même jour, après décision de direction).

---

## 1. Synthèse exécutive

**Le code n'est pas le problème. La donnée et le séquencement le sont.**

Techniquement, le projet est nettement au-dessus de ce qu'on attend d'un premier projet solo : architecture App Router propre (0 `any`, 0 `asChild`, Server Actions partout, 48 `'use client'` tous justifiés), RLS active sur 19/19 tables, CRON_SECRET vérifié sur les 6 crons, secrets jamais commités, build/CI verts (333/333 tests), prod sans erreur console, mobile impeccable.

Les trois constats majeurs, tous vérifiés deux fois en prod :

1. **Le vide est quantifié et brutal** : 8 events à venir au-delà du jour J dans toute l'app, 82 % des 173 groupes n'ont jamais eu un seul event, et 100 % du futur dépend d'une seule source (kpopofficial).
2. **La donnée scrapée est polluée** : ~92 events « release » sont du bruit promo, 16 events « concert » fantômes (feature pourtant abandonnée) avec des dates fausses, et des doublons cross-chaînes visibles sur toutes les pages.
3. **Le séquencement était inversé** : des features de rétention empilées pour une base de 2 comptes, pendant que la couverture data (le cœur de la promesse) restait à 4 groupes.

**Décision de direction (Rudy, 2026-06-12)** : pas de date de soft launch pour l'instant. Objectif = une **V1 assez bonne pour retenir dès le premier utilisateur**. Conséquence : le backlog est réordonné data-d'abord (cf. `BACKLOG.md`), et les features dont la valeur dépend du nombre d'utilisateurs sont gelées. La rétention restera **non mesurable** tant qu'il n'y a pas d'utilisateurs — c'est un fait, pas un reproche ; le lancement redeviendra le sujet quand la V1 tiendra sa promesse.

### Scorecard par dimension

| Dimension    | État      | Verdict court                                                                     |
| ------------ | --------- | --------------------------------------------------------------------------------- |
| Architecture | 🟢 Bon    | Conventions respectées, points faibles = maturité (dédup requêtes), pas structure |
| Sécurité     | 🟢 Bon    | Socle solide ; 1 action exposée sans garde + 3 toggles dashboard en retard        |
| DB prod      | 🔴 Faible | Infra saine mais contenu : vide massif + pollution + doublons                     |
| UX prod      | 🟡 Moyen  | Socle propre (0 erreur console, mobile OK) ; landing sans image, vide visible     |
| Tests/build  | 🟢 Bon    | CI complète, tests métier réels ; trous ciblés (slots.ts, e2e hors CI)            |
| Scraping     | 🟡 Moyen  | Pipeline vivante et résiliente, mais **aveugle** (échecs silencieux)              |
| Produit      | 🔴 Faible | Promesse (173 groupes) non tenue par la pipeline (4 groupes auto)                 |
| Docs         | 🟡 Moyen  | Riches mais dérive : claims faux, plans morts non marqués, état périmé            |

---

## 2. Données prod — les chiffres de référence (2026-06-12)

Mesurés par SQL sur le projet Supabase `lgewrmrbksgtjmzzebhz`, re-vérifiés indépendamment :

- **Events** : 320 au total ; 18 avec `start_at >= aujourd'hui` dont 10 le jour même → **8 events futurs** au-delà du jour J, horizon 2026-07-06, **tous** source kpopofficial.
- **Groupes** : 173 ; **31 ont ≥1 event** (toutes époques), **16 ont ≥1 event à venir** (9 %), **142 (82 %) n'ont jamais eu un seul event**. BTS, Blackpink, TWICE, NewJeans, Seventeen, Stray Kids, ENHYPEN, TXT, NCT : 0 event chacun.
- **Sources** : youtube_api = 8 chaînes couvrant 4 groupes (243 events, quasi tout du passé) ; kpopofficial = 23 groupes touchés (27 events, seule source de futur) ; music shows carrd = 17 groupes (50 events, visibilité ~24-48 h max).
- **Communauté** : 2 comptes (dernier signup 27/05), 19 follows, 1 note, 7 commentaires (dernier 29/05), 0 mv_like, 2 push subscriptions. Toute mesure de rétention est statistiquement impossible.
- **Couverture médias** : groups.image_url 100 % ✅ ; members.photo_url 57 % manquant ; members.birthday couvert à 96,9 % ✅ ; banner_url 99 % manquant (non bloquant).
- **`spotify_followers` : NULL sur 173/173** — le code a mergé le 09/06, le cron hebdo (lundi 04:00) n'est jamais passé depuis. Premier peuplement attendu le 2026-06-15.

---

## 3. Findings par dimension

### 3.1 Data & DB prod

- 🔴 **CRITICAL ✅ — Le vide : 8 events futurs, 82 % des groupes à zéro, SPOF kpopofficial.** Chiffres §2. Un fan qui suit autre chose que les 4 groupes MVP ouvre un calendrier vide ; 100 % du futur au-delà de ~48 h repose sur une source fan-run du même type que dbkpop (morte en 2025). → Chantier n°1 du backlog : couverture + 2ᵉ source de comebacks annoncés.
- 🔴 **CRITICAL ✅ — Les groupes réellement suivis sont vides.** 12/16 groupes suivis par les users actuels (dont Blackpink, Jennie, Lisa, Jung Kook) ont 0 event. La promesse échoue dès les premiers testeurs.
- 🟠 **HIGH ✅ — Classification YouTube polluée.** youtube_api : mv=108, release=92, other=27, concert=16. Les 92 « release » incluent Official Audio, cheering guides, teasers, vlogs (« LEMONADE Recipe », « WDA Cheering Guide ») ; les 16 « concert » sont des vidéos promo datées à la **date d'upload** (ex. « Next Stop is…SINGAPORE 2026.06.13 » daté au 31/05) alors que les concerts sont officiellement abandonnés (§8 du plan archivé). **Aggravant vérifié** : `notify-comebacks` push-notifie sur `['mv','release']` → le bruit peut déclencher des push erronées. Problème actuel, pas legacy (insertions du 10-12/06 concernées). → Ne jamais déduire release/concert d'un upload YouTube ; purge + reclassement.
- 🟠 **HIGH ✅ — Doublons cross-chaînes.** La clé unique inclut `source_url` : un même MV posté sur 2 chaînes passe. Mesuré : 21 clusters / 50 lignes, dont ILLIT « ICONIC BY MISTAKE » ×2, « Tick-Tack » ×2, BABYMONSTER « SUGAR HONEY ICE TEA » ×2, aespa « Better Things » ×2 — **visibles dans « Recent comebacks » sur toutes les pages**. → Dédup par videoId YouTube à l'ingestion + purge des paires.
- 🟡 **MEDIUM — Ledger de migrations désynchronisé.** Repo : 0001..0030 ; `supabase_migrations` en prod : 24 entrées (dernière = 0025). Les objets 0026-0030 existent en prod (appliqués via dashboard/MCP hors tracking). Un futur `db push` rejouera ou divergera. → `supabase migration repair` / insertion des versions.
- 🟡 **MEDIUM — `spotify_followers` 0/173** (claim du brief prématuré). → Déclencher manuellement `GET /api/cron/refresh-images` avec le Bearer, vérifier lundi 15/06.
- 🟡 **MEDIUM — Music shows : aucune visibilité au-delà de ~24-48 h.** max(start_at) = jour de l'audit alors que la source est scrapée la veille. Limite de la source ou du parser — à trancher ; impact direct sur « ta semaine k-pop ». → Vérifier le contenu brut du carrd ; documenter si limite de source.
- 🟡 **MEDIUM — 6 events type `mv` sans slug** → potentiellement injoignables via `/mv/[slug]` (seul chemin d'accès). À vérifier/backfiller.
- 🔵 **LOW — Advisors performance** : 22 policies RLS avec `auth.uid()` non wrappé (`(select auth.uid())`), 15 FK non indexées (events.source_id en tête), index inutilisés. Zéro impact à 2 users, fix mécanique en une migration. → À faire en lot.
- 🔵 **LOW — Couverture médias** : 477/833 membres sans photo (cohérent avec le page-pruning déjà acté) ; 50 events music_show sans image (1 image statique par émission ×6 suffirait).

### 3.2 Scraping

- 🟠 **HIGH ✅ — Les crons échouent en silence.** Les 3 routes de scraping renvoient HTTP 200 `{ok:true}` même en **échec total** (toutes sources en erreur) ; Vercel ne signale un cron qu'en non-2xx ; logs Hobby ~1 h de rétention. `kpopofficial.ts` : `if (!res.ok) continue` — un 404/changement de domaine est invisible. **Aggravant vérifié** : `last_scraped_at` est mis à jour même en échec total → le signal de fraîcheur DB ment aussi. Le mode d'échec le plus probable (changement de HTML) serait indétectable indéfiniment. → Contrat d'échec : 500 si 0 source OK ; écrire dans `scrape_log` ; conditionner `last_scraped_at` au succès.
- 🟡 **MEDIUM ✅ — `scrape_log` est morte.** Table + policy + types générés existent, **aucun code n'y écrit**, 0 ligne en prod. `SECURITY_AUDIT.md` la présentait comme mitigation monitoring (claim corrigé le 2026-06-12). → Câbler ou supprimer.
- 🟡 **MEDIUM — Couverture YouTube : 4 groupes / 173.** Le script de discovery (`SCRAPING.md §4`) est toujours en TODO. → Cf. chantier couverture (BACKLOG P0).
- 🟡 **MEDIUM ⚠️ (dégradé de high) — Le plan d'élargissement repose sur un calcul de quota faux d'un facteur ~20-40.** Le plan archivé suppose 3-5 units/fetch ; le scraper réel fait 2× `search.list` à **100 units/call** = 200 units/source. À 173 groupes = 34 600 units/jour, 3,5× le quota gratuit (10 000). Aucune gestion de `quotaExceeded` dans le code. Latent (8 sources actuelles = 1 600 units/jour, marge ×6) mais **prérequis bloquant** de tout élargissement. → Réécrire sur `playlistItems.list` (1 unit/chaîne, ~100× moins cher) + quota tracking.
- 🔵 **LOW — kpopofficial insère des `type='mv'` sans `mv_kind`** (6 en prod), contournant la classification documentée en `SCRAPING.md §8` — ils passent tous les filtres comme main MV. → Poser `mv_kind:'main'` explicite ou documenter l'exception.
- 🔵 **LOW — Dérive doc/code SCRAPING.md** : type `music_shows` absent du tableau §1, §6 ne liste qu'1 cron sur 6, numéros de ligne périmés. (Corrigé le 2026-06-12.)
- ℹ️ **Sources externes vérifiées vivantes** au 2026-06-11/12 : kpopofficial HTTP 200 avec classes CSS du parser intactes, contenu juin 2026 ; carrd music shows à jour. Les 10 sources actives ont toutes tourné dans les 24 h précédant l'audit.

### 3.3 Sécurité

- 🟡 **MEDIUM — Server Action `getOpenReports` exposée sans garde.** `src/lib/comments/moderation.ts` est un module `'use server'` : chaque export est un endpoint HTTP. `getOpenReports()` n'appelle pas `requireAdminUser()` (contrairement à `resolveReport`/`dismissReport`) et lit la file de modération via `service_role` (bodies de commentaires y compris soft-deleted + usernames), en contournant la RLS. La garde de la page `/admin/reports` ne protège pas l'action. → `requireAdminUser()` en 1ʳᵉ ligne, ou déplacer la lecture dans un module non-`'use server'`. **Auditer tout export des fichiers `'use server'`.**
- 🟡 **MEDIUM — Leaked-password protection toujours OFF** (recommandation SECURITY_AUDIT jamais appliquée, confirmé par advisor live). → Toggle dashboard Supabase, zéro code.
- 🟡 **MEDIUM — CSP en report-only avec `unsafe-inline`/`unsafe-eval`** : aucune défense XSS active en prod (vérifié par HEAD sur la prod) ; seule barrière = échappement React. → Passer en enforce avec nonces Next 16 avant toute ouverture publique.
- 🔵 **LOW — `handle_new_user` : le revoke de la migration 0025 est inefficace.** `revoke ... from anon, authenticated` ne retire pas le grant **PUBLIC** par défaut (proacl vérifié : `=X` présent) → anon/authenticated l'héritent toujours ; l'advisor fire encore, idem `group_follow_counts` et `profile_stats`. Exploitabilité faible (fonction trigger qui échoue hors contexte). → `revoke execute ... from public;` dans une nouvelle migration.
- 🔵 **LOW — Rate-limits non atomiques** (check-then-insert) sur comments/suggestions, absents sur push subscribe, votes, ratings, likes, follows, avatar. Atténué par l'auth requise + rate-limit natif Supabase Auth. → Acceptable pré-audience ; vrai limiteur avant ouverture publique.
- 🔵 **LOW — Buckets publics listables** (`avatars`, `banners`) : policies SELECT larges sur `storage.objects` → énumération des user_id ayant un avatar. → Resserrer (l'accès par URL publique marche sans policy de listing).
- 🔵 **LOW — CRON_SECRET : comparaison non constante-temps + fallback `Bearer undefined`** si la var était vidée. Risque actuel faible (secret défini, crons opérationnels). → Helper centralisé qui refuse si falsy + `timingSafeEqual`.
- ✅ **Forces vérifiées** : RLS 19/19 avec policies dans la même migration, aucune policy d'écriture permissive, 6/6 crons gardés par CRON_SECRET, aucun secret en dur ni commité (historique git vérifié), `service_role` server-only, inputs user et données scrapées validés avant insert, admin gardé par `isAdmin` côté serveur (sauf l'exception ci-dessus).

### 3.4 UX prod (visiteur déconnecté, desktop + mobile 390×844)

- 🟠 **HIGH — Landing : zéro image, ~80 % de la page = mur de 173 noms.** Mesuré en prod : `imgTotal=0` sur toute la page. Le hero est propre (H1, 2 CTA, « Free · No spam · Your timezone ») — c'est la suite qui ne vend rien : aucun aperçu produit, aucune preuve sociale. → Refonte : montrer le calendrier/countdowns en image, grille de photos des groupes, compteur.
- 🟠 **HIGH — Le futur visible est porté par les anniversaires.** Échantillonnage du calendrier : 15/06 = 3 anniversaires + 2 drops ; 19/06 = 2 anniversaires seuls ; 20/06 = « No events this day » ; ~3 vrais drops sur 3 semaines. « Recent discussions » (affiché sur 3 pages) ne contient qu'**un** thread daté du 29/05 — il crie « ville fantôme ». → Couverture data (P0) + masquer « Recent discussions » sous un seuil.
- 🟡 **MEDIUM — Doublons visibles dans « Recent comebacks »/« Latest MVs »** : 4 entrées sur 10 sont des dupes (cf. 3.1). Le module le plus vu de l'app contredit le positionnement « outil sérieux ».
- 🟡 **MEDIUM — Le CTA « Sign up » du header déborde de sa pastille sur desktop** (texte sur 2 lignes, mesuré 1366×900 ; cause : pas de `whitespace-nowrap` avec `h-7` figé dans `auth-menu.tsx`). Bouton de conversion principal. → Fix une ligne.
- 🟡 **MEDIUM — SEO : title nu « KStage » sur la landing ET les 173 pages groupes** (pas de `generateMetadata` sur `groups/[slug]`), aucun canonical. OG par ailleurs complet, title correct sur les pages MV. → `generateMetadata` groupes + metadataBase/canonical + title landing aligné sur l'og:title.
- 🔵 **LOW — `/my` répond 404** (aucune route dans le repo, aucun lien interne) alors que le brief la listait comme page live. (Brief corrigé le 2026-06-12.)
- 🔵 **LOW — Labels anniversaires en français** (« Hoshi — 30 ans ») dans une UI anglaise — verrouillé par 3 assertions de test. → « turns 30 » + maj des tests.
- 🔵 **LOW — Les cards Music Show sortent vers le carrd externe** sans indicateur ni `target=_blank`.
- 🔵 **LOW — Cold start : 6,6 s avant DCL à la première visite** (TTFB 2 870 ms), tout est rapide à chaud (TTFB 25-35 ms). Mesure unique, typique Vercel Hobby serverless. → Re-mesurer ; envisager landing statique/ISR.
- ✅ **Forces vérifiées** : 0 erreur console (hors 404 /my), 0 image cassée sur 9 pages, bottom-nav mobile présente, empty states actionnables, /groups et /mvs visuellement riches, countdowns visibles même déconnecté.

### 3.5 Architecture

- 🟡 **MEDIUM — Aucune déduplication per-request des requêtes Supabase.** React `cache()` jamais utilisé : `getGroups()`/`getFollowedGroupIds()` exécutés en double page+sidebar, `loadMv()` doublé entre `generateMetadata` et la page, le root layout ajoute getUser+profile+groups séquentiels à chaque navigation. ~5-8 round-trips économisables par page authentifiée. → Wrapper les queries partagées dans `cache()` (une ligne chacune) + `Promise.all` dans le layout.
- 🔵 **LOW — Bloc « fetch tier » copié-collé sur 4 pages** → extraire `getViewerProfile()` wrappé en cache().
- 🔵 **LOW — Code mort vérifié** : `getMemberMvs`, `grouped-event-list.tsx`, `ui/card.tsx`, `ui/toggle.tsx`, `revalidatePath('/')` doublé dans `approveSuggestion`. → Petit PR d'hygiène.
- 🔵 **LOW — Commentaire périmé** dans `youtube-embed.tsx` (« YT pas dans next.config ») alors que `i.ytimg.com` **est** whitelisté. → Corriger le commentaire ou passer à next/image.
- 🔵 **LOW — N+1 dans le scraper YouTube** (SELECT idempotence par item) — impact cron uniquement. → Batcher en un `.in()`.
- 🔵 **LOW — Mini-waterfall sur `/mv/[slug]`** (like puis comments séquentiels) + commentaire inexact sur `getEventRatingSummary`.
- ✅ **Forces vérifiées** : 216 fichiers TS/TSX, pages 100 % Server Components, 0 `any` réel, 0 `asChild`, auth 100 % cookies SSR, mutations 100 % Server Actions, `next/font` + `next/image` quasi systématiques.

### 3.6 Tests & build

- 🟡 **MEDIUM — `slots.ts` (créneaux hebdo KST) : zéro test** sur la logique timezone la plus piégeuse du scraping (rollover de semaine, tolérance 12 h, KST→UTC), utilisée par les 6 sources music-shows fallback — leurs tests ne couvrent que les parsers, jamais `startAtIso`. → `slots.test.ts` avec `now` injectés.
- 🟡 **MEDIUM — Playwright ne tourne jamais en CI**, et le golden path auth se skip sans `E2E_AUTH_EMAIL`/`PASSWORD`. → Job CI smoke (sans credentials) + secrets GitHub pour auth.spec.
- 🟡 **MEDIUM — Golden path calendrier superficiel** : heading + liens de nav seulement, aucun event affiché vérifié, aucune navigation. → Étendre le spec.
- 🔵 **LOW — Fixture kpopofficial synthétique** (HTML construit à la main) là où les music-shows utilisent 9 captures prod réelles — contraire à la règle « real data over fixtures ». → Capturer une page réelle en fixture datée.
- 🔵 **LOW — jsdom global pour 33 fichiers dont 1 seul touche le DOM** : ~48 s de suite pour 680 ms de tests effectifs. → `environment: 'node'` par défaut + annotation jsdom sur `auth-menu.test.tsx`. Gain : suite en quelques secondes.
- 🔵 **LOW — `artist-validation.ts` (112 lignes, input public) et `normalizeUsername` sans aucun test**, alors que tous les modules voisins en ont. → Tests miroirs.
- ✅ **Forces vérifiées** : `tsc --noEmit` 0 erreur, eslint 0 warning, 333/333 tests verts, CI complète (prettier+eslint+tsc+vitest+build), math KST et builders de notifs réellement testés, fixtures prod réelles pour les 7 parsers music-shows.

### 3.7 Produit & stratégie

- 🔴 **CRITICAL ✅ (constat historique, traité par la décision du 2026-06-12)** — **Séquencement inversé** : features de rétention empilées pour 2 comptes, soft launch identifié comme goulot dans 3 docs mais opérationnalisé dans aucun (0 date, 0 checklist, 0 item de backlog), gate documentée du BACKLOG (« on finit l'étape 9 avant ») contournée dans les faits (~7 PRs de features depuis fin mai). **Résolution** : direction actée 2026-06-12 — pas de date de lancement visée, mais le backlog est réordonné data-d'abord et les features user-dépendantes sont gelées. La rétention reste non mesurable sans utilisateurs.
- 🔴 **CRITICAL ✅ — Promesse intenable : catalogue affiché de 173 groupes, pipeline auto sur 4.** Cf. §2. Le seed à 173 groupes a contredit le principe documenté (« 4 c'est le bon nombre, étendre par demande ») sans étendre la pipeline. → Chantier couverture + alignement promesse/pipeline (réduire les entry points des groupes vides).
- 🟡 **MEDIUM ⚠️ (dégradé de critical après réfutation partielle) — « Letterboxd du k-pop » : le positionnement, pas l'UI.** Deux vérificateurs indépendants ont établi que **l'UI masque déjà correctement le vide communautaire** (pas de « 0/10 » affiché, moyenne masquée si null, like masqué à 0, CTA « Be the first »). Le résidu réel : la phrase « pas d'effet ghost-town » du brief confond contenu-objet (les events, qui pré-existent) et contenu communautaire (les notes, à 1/264) ; et le pitch « Letterboxd du k-pop » ne doit pas être l'angle marketing tant qu'il n'y a pas de masse critique. → Corrigé dans le brief ; ratings = pari de rétention activable post-audience, pas différenciateur jour-1.
- 🟠 **HIGH ✅ — Wrapped (décembre) comme seul levier d'acquisition = circulaire.** Sans base utilisateur d'ici décembre, un Wrapped n'a rien à rétrospecter. → Gelé ; redevient pertinent si une audience existe à l'automne.
- 🟡 **MEDIUM ⚠️ — Effort mal placé (leçon rétrospective)** : commentaires Reddit-style complets + 833 pages membres livrés avant toute audience ; le préjudice visible est déjà mitigé (pruning exécuté, empty states). **Règle adoptée** : toute feature dont la valeur dépend du nombre d'utilisateurs (feed, RSVP, votes) est gelée jusqu'à un seuil d'users actifs ; toute feature utile à n=1 (calendrier, push, countdown, digest) est éligible.
- 🟡 **MEDIUM — Risques structurels non documentés** : r.jina.ai = SPOF gratuit sur toute la couverture music shows + tension avec la règle « respect robots.txt » du CLAUDE.md ; aucun plan de sortie des free tiers (Vercel Hobby = usage non commercial, Supabase free = plafonds MAU/egress) ; burn-out réduit à une ligne alors que la cadence réelle est de 270 commits/21 jours. → Section risques ajoutée au backlog ; demi-page suffit.
- ❌ **RÉFUTÉ — « Le garde-fou anti-ghost-town n'est pas appliqué aux ratings dans l'UI »** : faux dans le code actuel (cf. ci-dessus). Gardé pour trace : les preuves citées (audit UX A5/D3) dataient d'avant les empty states livrés.

### 3.8 Documentation

- 🟠 **HIGH — Claims factuels faux dans les docs de référence** (tous corrigés le 2026-06-12) : `SECURITY_AUDIT.md` présentait `scrape_log` comme monitoring en place (0 écriture) et le revoke `handle_new_user` comme effectif (PUBLIC l'a toujours) ; le brief affirmait `spotify_followers` peuplé (0/173), « pas de doublon au re-scrape » (doublons cross-chaînes prouvés) et listait `/my` comme page live (404).
- 🟡 **MEDIUM — Contradiction interne du plan POLISH_PERF_DATA** : `youtube_channel_ids[]` listé en « décision actée à ne PAS rediscuter » alors que le §4.2 du même fichier la déclare inutile (hypothèse fausse) ; spec complète du §8 Concerts conservée alors que la feature est abandonnée ; calcul de quota faux (cf. 3.2). → Fichier archivé avec bannière de correction.
- 🟡 **MEDIUM — PROJECT.md §9 périmé de 2 semaines** (daté 2026-05-29) ; redondance BRIEF ↔ PROJECT sans hiérarchie claire ; les 3 plans racine non marqués comme historiques. → §9 mis à jour, plans archivés dans `docs/archive/`, index créé (`docs/README.md`).
- 🔵 **LOW — BACKLOG.md contenait un item déjà résolu** (« Tests E2E à rafraîchir » — réécrits le 2026-05-30, vérifié dans le code). → Purgé à la réécriture.
- ℹ️ **Fausse alerte écartée** : un auditeur a cru que 6 crons violaient la limite Vercel Hobby — faux, la limite est 1×/jour **par cron** ; la config actuelle est conforme et les crons tournent (vérifié en DB).

---

## 4. Ce qui est solide (à préserver)

- Discipline git (branches/PR même en solo), migrations versionnées avec RLS dans la même migration.
- Qualité TypeScript/React au-dessus de la moyenne ; conventions CLAUDE.md réellement respectées.
- CI complète et verte ; tests métier sur les vrais pièges (KST, idempotence, parsers sur fixtures réelles).
- Pipeline de scraping résiliente par design (primary + 6 fallbacks music shows, 2-pass YouTube, idempotence par source).
- Docs riches et auto-critiques (les erreurs sont documentées — rare) ; l'audit UX interne avait déjà identifié « le vide » comme finding n°1.
- A11y soignée (jsx-a11y, Lighthouse 100), dark design cohérent, PWA + push opérationnels en prod.

---

## 5. Traçabilité

Audit réalisé le 2026-06-12 via : SQL direct sur la prod (Supabase MCP, lecture seule), advisors Supabase live, navigation Playwright sur la prod (desktop + mobile), exécution réelle de `tsc`/`eslint`/`vitest`, lecture exhaustive du code et des migrations, fetch des sources externes. Chaque finding critical/high a été soumis à un contre-vérificateur indépendant chargé de le **réfuter** ; les verdicts (confirmé/dégradé/réfuté) sont reflétés dans les sévérités ci-dessus.
