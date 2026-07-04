# BACKLOG — KStage (roadmap active)

> **Réécrit le 2026-06-12** sur la base de l'audit complet (`docs/AUDIT_PROJET_2026-06-12.md`).
>
> **Direction actée (Rudy, 2026-06-12)** : pas de date de soft launch visée. Objectif = une **V1 assez bonne pour être fonctionnelle et retenir dès le premier utilisateur**. Le calendrier doit tenir sa promesse pour n'importe quel groupe qu'un fan suit — c'est le chantier prioritaire, avant tout polish.
>
> **Règle de gel** : toute feature dont la valeur dépend du **nombre** d'utilisateurs (feed d'activité, RSVP/compteur, votes, Wrapped, forum) est gelée jusqu'à une audience réelle. Toute feature utile à **n=1** (calendrier, push, countdowns, digest) est éligible.

---

## P0 — Data : tenir la promesse du calendrier

> Constat (audit §2) : 8 events futurs dans toute l'app, 82 % des groupes sans aucun event, 100 % du futur dépend de kpopofficial. C'est LE chantier — un calendrier vide ne retient personne, quelle que soit l'UX.

1. ✅ **Nettoyer la classification YouTube** — fait 2026-06-12 (`feat/data-cleanup-classification`, cf. `SCRAPING.md §3.8`).
   - Scraper YouTube : gate **mv-only** (un upload = date de publication, jamais date d'event ; release/concert ne sont plus jamais déduits d'uploads).
   - Prod purgée : 135 lignes supprimées (92 release promo + 16 concerts fantômes + 27 other legacy ; zéro rating/comment/like dessus ; backup local pris avant suppression).
   - kpopofficial insère désormais `type='release'` (annonce datée sans vidéo — taxonomie MV=clip/Release=audio du 2026-05-27) ; les 6 `mv` sans `mv_kind`/slug re-typées → « mv sans mv_kind » et « mv sans slug » tombent à 0.
   - `notify-comebacks` (`['mv','release']`) ne peut plus pousser de bruit : release = kpopofficial uniquement.
   - État post-nettoyage vérifié en prod : youtube_api = 108 mv · kpopofficial = 27 release · music_shows = 50 ; total 320 → 185 ; les 8 events futurs intacts.
2. ✅ **Dédupliquer cross-chaînes** — fait 2026-06-12 (cf. `SCRAPING.md §3.9`). Correction d'analyse en route : les doublons sont des **uploads distincts** (videoId différents, ex. reposts `#ILLIT` de HYBE LABELS) — la dédup par videoId n'aurait rien attrapé ; implémenté en dédup **sémantique** (`normalizeMvTitle`, égalité stricte ±14 jours, tests sur paires prod réelles). Prod purgée : 5 lignes (4 reposts + 1 legacy « OUT NOW »), 0 paire restante vérifiée en DB et sur `/mvs`. Note : « Better Things (æ-aespa Ver.) » signalé par l'audit n'était PAS un doublon (version officielle distincte, conservée).
3. ✅ **Rendre le scraping observable** — fait 2026-06-12 (cf. `SCRAPING.md §6`). Helper `scrape-log.ts` + statuts ok/partial/error par run (dont la signature « pages 200 mais 0 entrée parsée ») ; HTTP 500 quand le run est inexploitable → visible dans le dashboard Vercel Crons ; `last_scraped_at` gaté sur récolte réelle ; migration 0031 (`details` jsonb). Bonus : **ledger de migrations réconcilié** (0026-0030 insérées dans `supabase_migrations.schema_migrations`, 0031 appliquée via le flux normal) — l'item P1 correspondant tombe.
4. ✅ **Réécrire le scraper YouTube sur `playlistItems.list`** — fait 2026-06-13 (cf. `SCRAPING.md §2`). Coût mesuré : **27 units pour les 8 sources** (vs 1 600) → l'élargissement à des centaines de sources tient dans le quota free. Premieres programmées captées (`pickStartAt`, events futurs), `QuotaExceededError` géré (arrêt propre + scrape_log), idempotence batchée, `sources.channel_id`/`subscriber_count` persistés à chaque run (migration 0032) → critère de popularité prêt pour P0.5. Piège découvert et corrigé en route : faux positif d'attribution via les hashtags des descriptions de chaînes umbrella (`SCRAPING.md §3.10`).
5. ✅ **Élargir la couverture aux ~30-50 groupes les plus suivis** — fait 2026-06-15 (cf. `SCRAPING.md §4` + §3.11).
   - ✅ Seed des chaînes YouTube (officielle + umbrella label) : discovery **oembed** par workflow multi-agents (40 groupes, chaque chaîne prouvée par un MV réel), mapping commité dans `scripts/youtube-channels.json`, seedé par `scripts/seed-youtube-sources.ts` (idempotent). Prérequis : migration 0033 (`UNIQUE(url, group_id)`) pour réutiliser une umbrella sur plusieurs groupes. Cron `scrape-youtube` parallélisé (batchs concurrents + `maxDuration`) pour tenir ~90 sources sous le timeout.
   - ✅ Backfill one-shot scripté (`scripts/backfill-youtube.ts`) : **couverture 4 → 44 groupes, ~108 → 402 MV en base**, 0 sur-attribution (vérifié : aucun MV sous 2 groupes). Canary jennie/bts/&TEAM d'abord → 3 pièges trouvés et corrigés (`SCRAPING.md §3.11`). Limites connues documentées : playlist uploads incomplète (Rosé/APT, §2) ; JK/Jimin MV uniquement HYBE LABELS profond (backfill ponctuel maxPages=60).
   - Note : le backfill enrichit le **catalogue passé** (pages groupes/`/mvs` ne sont plus des dead-ends vides) ; les **events futurs** restent fournis par kpopofficial + premieres programmées captées au quotidien.
   - ✅ Matching kpopofficial élargi (2026-06-13) : diagnostic réel via `scripts/diagnose-kpopofficial-matching.ts` (35 artistes non matchés sur juin-juillet), 3 patterns récupérés par `matchGroups` — suffixes d'édition « (JP) », collabs « A x B » (un event par groupe en DB), solos de membre « HAN (Stray Kids) » rattachés au parent. Résultat mesuré : 23 → 35 matchées, **+9 events dont 5 futurs** (aespa Japon, ATEEZ, P1Harmony, Dreamcatcher, Super Junior), horizon 06/07 → 28/07. Les non-matchés restants = rookies hors DB + entrées tours (bruit parser, ignoré volontairement).
   - ~~Déclencher `refresh-images` pour peupler `spotify_followers`~~ → **infaisable, vérifié le 2026-06-12** : l'API Spotify ne renvoie plus `followers` (ni `popularity`) aux apps client-credentials en mode développement — champ vide sur `/v1/search` ET `/v1/artists/{id}`, batch `/v1/artists?ids=` en 403. Testé en direct avec les creds du projet ; le run du jour a mis à jour 173/173 images mais 0 followers. La colonne restera NULL sauf passage de l'app Spotify en extended quota. **Critère de sélection top-30 : liste manuelle** (déjà la reco), ou subscribers YouTube (`channels.list` statistics, 1 unit — gratuit avec la réécriture P0.4).
6. ✅ **Aligner la promesse sur la data** — fait 2026-06-15.
   - **Pages groupe sans dead-end** : les anniversaires des membres (`getUpcomingAnniversaries`, fenêtre 90 j) sont désormais fusionnés au flux « Upcoming events » des pages groupe (comme home/calendrier le faisaient déjà). Une page groupe sans event programmé affiche ses birthdays à venir comme contenu plancher → plus de cul-de-sac vide. Vérifié en prod-local (`/groups/wjsn` : 0 event DB → affiche les anniversaires, l'empty-state a disparu).
   - **Onboarding piloté par la data** : l'onboarding mettait en avant le top-30 par _followers_ (≈ 0 sur un compte neuf) sans filtre de contenu → un nouvel user pouvait suivre des groupes au calendrier vide. Désormais tri par contenu réel d'abord (`getGroupEventCounts` : groupes avec events/MV en tête, puis follows, puis volume), complété jusqu'à 30. Un nouveau compte suit donc des groupes dont le calendrier n'est pas vide.
   - **Landing + annuaire `/groups` laissés tels quels** volontairement : la landing est marketing (« N groupes trackés » = la couverture réelle), et l'annuaire est un browse-all qui n'est plus un piège puisque les pages groupe ont du contenu plancher.
   - Bonus i18n (P1) : libellés d'anniversaire passés en anglais (« turns 30 » au lieu de « 30 ans »), désormais visibles sur les pages groupe — `annivTitle` + 3 assertions de test.
7. ✅ **Casser le SPOF kpopofficial** — fait 2026-06-15 (`SCRAPING.md §10`). Scout de 4 candidats fetchés en vrai (règle `feedback_data_sources`) : **Wikipedia « 2026 in South Korean music »** retenu (vivant, forward-looking, wikitext brut stable, failure mode ≠ kpopofficial) ; Reddit `dead` (403 anti-bot), kpopschedule.com `viable` mais JS-only/faible volume, MusicBrainz surtout du passé. Implémenté : cœur partagé `comeback-ingest.ts` (matching + insert) réutilisé par kpopofficial **et** `wikipedia-releases.ts` ; cron lance les 2 (échecs indépendants) ; **dédup cross-source ±3 j** (la 2ᵉ source comble les trous, ne duplique pas). kpopofficial reste primaire. Vérifié en prod : 0 doublon (les 4 matches Wikipedia déjà couverts → skippés). Parser testé sur fixture wikitext réelle (8 tests).
8. ✅ **Music shows : visibilité au-delà de 24-48 h** — investigué + documenté 2026-06-15 (`SCRAPING.md §9` « Limite de couverture temporelle »).
   - Vérifié : le carrd ET les broadcasters ne publient les lineups que tardivement (veille en semaine, 2-3 j le week-end) ; aucune source ne liste plusieurs semaines. Entre cycles, le carrd montre la semaine passée avec lineups « ~ » placeholder (et Jina peut servir du cache périmé). **Pas un bug parser** : il capte déjà tout l'exposé. État prod 15/06 : 6 shows futurs (jusqu'à +4 j) = la semaine en cours.
   - Décision : couverture = semaine courante, conforme à « ta semaine k-pop ». Limite documentée.
   - **Piste (non faite, décision produit)** : slots récurrents synthétiques depuis le planning hebdo fixe (comme les anniversaires) pour afficher les 6 shows même sans lineup encore posté. Nécessite dédup vs events scrapés + le choix d'afficher un show « lineup à venir ». À trancher si « ta semaine » paraît trop vide en début de cycle.

## P1 — Quick wins (corrections vérifiées, effort faible)

### UX / SEO

- ✅ **Fix bouton « Sign up »** (débordement pastille desktop) — fait 2026-06-15 : `whitespace-nowrap` dans `auth-menu.tsx`.
- ✅ **SEO pages groupes** — fait 2026-06-15 : `generateMetadata` sur `groups/[slug]` (title « {groupe} — comebacks & schedule · KStage » + description + canonical + og), title landing aligné « KStage — your k-pop calendar ». `metadataBase` était déjà en place.
- ✅ **Labels anniversaires en anglais** (« turns 30 » au lieu de « 30 ans ») — fait 2026-06-15 avec P0.6 (`src/lib/events/anniversaries.ts` + 3 assertions).
- ✅ **Masquer « Recent discussions » sous un seuil** — fait 2026-06-15 : section cachée si `< 3` discussions (`sidebar-right.tsx`, `DISCUSSIONS_MIN`), aligné règle de gel des features sociales.
- ✅ **Cards Music Show** : `target=_blank` (déjà présent) + **icône external-link** — fait 2026-06-16. Tout event à `source_url` externe (music_show, live, release kpopofficial…) affiche une pastille `ExternalLink` + label sr-only « opens an external site », sur l'`event-card` générique **et** `home/event-card`. Vérifié au rendu sur `/calendar` : 1 carte externe → 1 icône, 12 cartes internes → 0.
- ~~**`/my`** : redirect vers `/calendar`~~ → **sans objet (2026-06-15)** : aucune référence à `/my` dans le code (vérifié), le brief avait déjà été corrigé.

### Sécurité / ops

- ✅ **`getOpenReports` : `requireAdminUser()`** — fait 2026-06-15 (`moderation.ts`). Audit des 11 fichiers `'use server'` : seul getOpenReports était non-gardé ; banner-actions/suggestions/resolveReport/dismissReport ont leurs gardes `isAdmin`, les actions user passent par le client authentifié (RLS), auth/actions service-role = flux signup légitime.
- **3 toggles/migrations Supabase** (advisors vérifiés 2026-06-15) :
  - ✅ `revoke execute on handle_new_user from public/anon/authenticated` → appliqué (migration 0034), vérifié non exécutable par anon/authenticated.
  - ✅ **leaked-password protection** → activée par Rudy (dashboard Supabase Auth), confirmée 2026-06-16 : l'advisor sécurité ne la liste plus. Advisors re-runés : restent seulement `citext in public` + `group_follow_counts`/`profile_stats` SECURITY DEFINER — ces 3 sont **intentionnels/acceptés** (citext porte la colonne `username`, déplacer l'extension casserait la colonne ; counts/stats publics par design).
  - ✅ **buckets listing** — fait 2026-06-16 (migration 0035, appliquée + vérifiée) : drop des policies SELECT larges `avatars`/`banners`. Sûr car buckets publics → affichage via `getPublicUrl` (indépendant de la policy SELECT), uploads inchangés, buckets vides, aucun `.list()`. Note : `group_follow_counts`/`profile_stats` (definer, exécutables anon) laissés tels quels — **intentionnels** (counts/stats publics, RLS contournée par design).
- ✅ **Migration perf RLS** — appliquée & vérifiée 2026-06-16 (migration 0034) : `(select auth.uid())` sur les **21 policies** + `revoke handle_new_user` + index `events.source_id`/`sources.group_id`. Confirmé : advisors `auth_rls_initplan` tombés à 0, `handle_new_user` non exécutable par anon/authenticated. (Autres FK non indexées = petites tables → on évite le sur-index, cf. advisor unused_index.)
- ✅ **Ledger de migrations réconcilié** (2026-06-12, avec P0.3) : versions 0026-0030 insérées dans `supabase_migrations.schema_migrations`, 0031 appliquée via `apply_migration` (flux normal restauré).
- ✅ **Helper CRON_SECRET** centralisé — fait 2026-06-16 : `src/lib/cron/auth.ts` (`isAuthorizedCron`, refuse si falsy + compare constante-temps), branché sur les 6 crons (fin du fallback `Bearer undefined` + duplication).
- ✅ **Hygiène code** (partiel) — fait 2026-06-16 : code mort **vérifié puis** supprimé (`getMemberMvs`, `grouped-event-list.tsx`, `ui/card.tsx`). ⚠️ `ui/toggle.tsx` **conservé** (le backlog se trompait : utilisé par `ui/toggle-group`). Restent (mineurs, non faits) : `revalidatePath` doublé + commentaire périmé `youtube-embed.tsx`.

### Perf (léger, avant trafic)

- ✅ **React `cache()`** sur les queries partagées — étendu 2026-06-16 : `getGroups`, `getFollowedGroupIds` (sidebar + page dans le même render) et `getEventBySlug` (`generateMetadata` + composant de `/mv/[slug]`, 2 requêtes → 1) wrappées `cache()`, en plus de `getGroupBySlug` (2026-06-15). **Root layout** (2026-06-16) : `profile` + `dialogGroups` passés en `Promise.all` (2 allers-retours séquentiels → concurrents). Reste possible (non bloquant) : helper `getViewer()` caché pour dédup `auth.getUser()` cross-composants — refactor plus large, repoussé.
- ✅ **Vitest : `environment: 'node'` par défaut** — fait 2026-06-16 : + `// @vitest-environment jsdom` sur `auth-menu.test.tsx` (seul test DOM). Suite ~19-29 s → **~6 s** (env cumulé 340 s → 3,6 s), 360 tests verts.

## P2 — Habitude & surfaces (utile à n=1)

- **Digest hebdo « ta semaine k-pop »** (push + option e-mail) — le hook d'habitude n°1 non livré ; n'a de la valeur qu'une fois P0 fait (sinon le digest est vide). **→ Lot E du plan de reprise 2026-07-04 (en cours).**
- ✅ **Refonte landing** — faite avec la refonte Data Desk (2026-07-03) : grille de photos triée par notoriété YouTube + countdown temps réel + 3 étapes. L'item « mur de 173 noms » est obsolète.
- ✅ **Refonte home connectée** — faite avec la refonte Data Desk (2026-07-03) : home 8 modules (ticker, hero dernier MV, queue, week glance, fresh drops).
- **CSP en enforce** — **décision 2026-07-04** : les nonces Next 16 forcent le rendu dynamique global (tue static/ISR) et `style-src` nonce est une impasse (attributs `style=""` React) → durcissement pragmatique à la place (flip enforce de la policy actuelle + retrait `unsafe-eval` en prod, Lot D du plan de reprise). L'enforce script-src complet reste gated pré-ouverture publique.
- **Rate-limit robuste** (atomique) sur postComment/submitSuggestion/submitFeedback/savePushSubscription — avant toute ouverture publique. **→ Lot B du plan de reprise 2026-07-04 (en cours)** : RPC `consume_rate_limit` + advisory lock ; savePushSubscription n'a aujourd'hui AUCUN cap.

### UX polish différé (audit 2026-07-04 — écarts assumés, pas des oublis)

- **Page interne de visionnage des stages** (type `/mv` avec player embed) — aujourd'hui les bannières music_show ouvrent YouTube directement (icône lien externe affichée). À faire si les stage links prouvent leur usage.
- **Quick-tap ratings mobile** (presets à la place du slider) — le slider + bouton Save suffit pour l'instant.
- **Install hint iOS sur la home** (bannière « Ajouter à l'écran d'accueil ») — l'app est installable, le hint n'existe que sur /account.
- **Partage d'event** (bouton share/copy link sur une carte event) — aucun mécanisme de partage aujourd'hui.

## Tests (accompagne P0/P1)

- ✅ **`slots.test.ts`** — fait 2026-06-16 : la logique créneaux hebdo KST (`nextWeeklySlotIso` rollover + tolérance 12 h ; `kstDateTimeToIso` KST→UTC + bornes invalides) est couverte (12 assertions, valeurs ISO calculées à la main confirmées au run).
- **E2E en CI** : job smoke (sans credentials) + secrets GitHub pour le golden path auth (aujourd'hui : jamais exécuté automatiquement).
- **E2E smoke `/search`** : la route est nouvelle (refonte 2026-07-03) et n'a aucun test E2E — un smoke « taper une requête → résultats visibles » suffirait.
- ✅ **Étendre le spec calendrier** — fait 2026-06-16 : test de navigation Next/Previous month (URL + titre de mois changent puis reviennent), **déterministe** — pas d'assertion sur un event seedé précis (la data prod change → flaky ; c'est le câblage de la nav qu'on teste). En route : l'ancien test cherchait un `<h1>Calendar</h1>` retiré lors d'un redesign (e2e jamais lancé en CI → jamais détecté) → la page calendrier reçoit un vrai `h1` (titre de mois `h2`→`h1`, gain a11y/SEO) et l'assertion est corrigée. Vérifié : 4/4 smoke verts (chromium, serveur chaud — les cold-compile Turbopack sur E:\ dépassent le timeout par test, pas un bug app).
- ✅ **Fixture kpopofficial réelle** — fait 2026-06-16 (`__fixtures__/kpopofficial-june-2026.html`, capture directe datée). En la construisant, **bug de couverture découvert et corrigé** (règle « real data over fixtures » qui paie) : kpopofficial a migré l'artiste de `gspb_meta_value` vers `.gspb-dynamic-title-element` → le parser ratait silencieusement le carrousel + les éditions JP (`matched ~10/run` au lieu de ~20+, **dégradation pas panne** — la grille passait encore). Fix `kpopofficial.ts` (titre dynamique prioritaire, fallback meta) + 3 tests sur la fixture. Strictement non régressif, sans risque de donnée corrompue (`matchGroups` gate l'insert). Cf. `SCRAPING.md §3.12`. Vérif post-déploiement : `matched` doit remonter au prochain cron `scrape-comebacks`.
- ✅ **Tests `artist-validation.ts`** (input communautaire public) + `normalizeUsername` — fait 2026-06-16 : `parseArtistSuggestionInput` (nom, kind, hex, debut date, URLs http(s), parsing/cap membres, solo→[]) et `normalizeUsername` (casse préservée, trim, bornes 3-20, charset) couverts (16 assertions).

## Risques à documenter (une demi-page, une fois)

✅ **Fait 2026-07-04** → `docs/RISKS.md` (jina SPOF + règle d'arbitrage, plafonds free tiers + triggers ~45 $/mois, minimum maintenable = 1 check hebdo de 10 min).

## Gelé — gaté sur audience réelle

- Feed d'activité communautaire ; « j'attends ce comeback » (RSVP + compteur de hype) ; **KStage Wrapped** ; forum/modérateurs ; listes partageables ; reco « à suivre ». Un compteur à zéro est une anti-preuve sociale.
- ~~Wiring des mocks home~~ — **obsolète 2026-07-04** : `src/lib/mocks/home.ts` supprimé par la refonte Data Desk, la home branche déjà de vraies queries.

## Premium (V2+) — abonnement payant (demande Rudy 2026-07-03)

> Le socle technique existe déjà : `profiles.tier` (`free`/`premium`, protégé par trigger), cap `FREE_VISIBLE_FOLLOWS = 10` dans la sidebar. Aucune de ces features ne se construit avant une audience réelle — mais chaque nouvelle feature devrait se demander « free ou premium ? » dès sa conception.

Idées activables (ordre approximatif valeur/effort) :

1. **Follows illimités visibles** — le cap free=10 existe déjà, il suffit d'un paywall UI. Le plus simple à activer.
2. **Push personnalisés** — lead-times custom par type d'event (l'infra `user_notification_settings.lead_time_minutes` existe), rappels multiples (J-7 + J-1 + heure H).
3. **Export calendrier** — flux iCal / sync Google Calendar des events suivis (déclencheur d'abonnement classique des apps calendrier).
4. **Digest hebdo enrichi** — version email premium avec stats perso, teaser des drops de la semaine (l'infra send-digest existe).
5. **Stats avancées + Wrapped** — page stats perso approfondie (distribution des notes, streaks, genres) + le Wrapped annuel partageable en premium early-access.
6. **Thèmes exclusifs** — variantes de thème (couleurs de bias, thèmes par groupe) sur le socle de tokens existant.
7. **Badge profil premium** — signal social discret (le champ tier est déjà rendu côté profil).
8. **Alertes mot-clé** — push sur mention d'un mot-clé dans les titres ingérés (« tour », « japan »…).

Paiement : Stripe Checkout + webhook → update `profiles.tier` (le trigger `protect_profile_privileges` devra autoriser le service role). À cadrer le moment venu.

## Ops manuelles en attente

- **Re-scrape kprofiles des photos membres** (2026-07-03) : les photos datent du seed (aespa notamment) ; kprofiles est fragile → op manuelle ciblée sur les groupes phares via les scripts `scripts/roster/`, pas de cron. La fraîcheur du hero home vient désormais du thumbnail du dernier MV, ce qui réduit l'urgence.

## Reprises de l'ancien backlog (toujours pertinentes, non re-vérifiées par l'audit)

- **Admin hub** (`/admin`) : grille de liens vers les sous-sections.
- **Suggestions** : édition admin avant approbation ; édition/suppression par l'auteur (nécessite policies `update`/`delete` own-rows sur `event_suggestions`) ; notif push au contributeur (infra prête).
- **Music shows — repenser l'affichage** : un Music Bank à 8 groupes = 8 events redondants ; idée « le show comme entrée suivable » (titre = lineup). À cadrer.
- **Polish home** : groupage temporel (Aujourd'hui/Demain/Cette semaine), cap 10 events/bucket + « voir les N autres », champ agence incohérent (4 groupes seulement) — à re-trier au prochain passage sur la home.
- **Community pulse** : formulaire « Suggest event » en modal + « Suggest fix » + toast.

---

> Historique : l'ancien backlog (2026-05-30) et les plans exécutés sont archivés dans `docs/archive/` (git) ; l'item « Tests E2E à rafraîchir » était résolu depuis le 2026-05-30 et a été purgé.
