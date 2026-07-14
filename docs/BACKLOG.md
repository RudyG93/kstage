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
   - ✅ **Piste tranchée OUI et faite 2026-07-11** : slots récurrents synthétiques (`src/lib/events/show-slots.ts`, read-time comme les anniversaires, jamais en DB) sur calendrier + week glance, état « Lineup TBA », dédup par (show, jour KST) vs épisodes réels, clamp à maintenant. Mandat contenu délégué par Rudy (opération « rendre l'app launchable »).

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
  - ✅ **leaked-password protection** → activée par Rudy (dashboard Supabase Auth), confirmée 2026-06-16 : l'advisor sécurité ne la liste plus. Advisors re-runés : restent `citext in public` + `group_follow_counts`/`profile_stats`/`consume_rate_limit` SECURITY DEFINER — **intentionnels/acceptés** (les fonctions agrègent des compteurs à travers des tables sous RLS et n'en renvoient aucune ligne privée ; `SECURITY INVOKER` casserait l'agrégation, révoquer casserait les pages publiques + le rate-limit ; anon/authenticated par design). **Correction (2026-07-14)** : `citext` porte bien `profiles.username`, mais `ALTER EXTENSION citext SET SCHEMA extensions` NE casserait PAS la colonne (déplacement par OID, opération Supabase standard) — donc le WARN est **cosmétique et optionnellement soldable** si on veut un rapport d'advisors 100 % propre. Non appliqué (règle : autorisation Rudy par migration).
  - ✅ **buckets listing** — fait 2026-06-16 (migration 0035, appliquée + vérifiée) : drop des policies SELECT larges `avatars`/`banners`. Sûr car buckets publics → affichage via `getPublicUrl` (indépendant de la policy SELECT), uploads inchangés, buckets vides, aucun `.list()`. Note : `group_follow_counts`/`profile_stats` (definer, exécutables anon) laissés tels quels — **intentionnels** (counts/stats publics, RLS contournée par design).
- ✅ **Migration perf RLS** — appliquée & vérifiée 2026-06-16 (migration 0034) : `(select auth.uid())` sur les **21 policies** + `revoke handle_new_user` + index `events.source_id`/`sources.group_id`. Confirmé : advisors `auth_rls_initplan` tombés à 0, `handle_new_user` non exécutable par anon/authenticated. (Autres FK non indexées = petites tables → on évite le sur-index, cf. advisor unused_index.)
- ✅ **Ledger de migrations réconcilié** (2026-06-12, avec P0.3) : versions 0026-0030 insérées dans `supabase_migrations.schema_migrations`, 0031 appliquée via `apply_migration` (flux normal restauré).
- ✅ **Helper CRON_SECRET** centralisé — fait 2026-06-16 : `src/lib/cron/auth.ts` (`isAuthorizedCron`, refuse si falsy + compare constante-temps), branché sur les 6 crons (fin du fallback `Bearer undefined` + duplication).
- ✅ **Hygiène code** (partiel) — fait 2026-06-16 : code mort **vérifié puis** supprimé (`getMemberMvs`, `grouped-event-list.tsx`, `ui/card.tsx`). ⚠️ `ui/toggle.tsx` **conservé** (le backlog se trompait : utilisé par `ui/toggle-group`). Restent (mineurs, non faits) : `revalidatePath` doublé + commentaire périmé `youtube-embed.tsx`.

### Perf (léger, avant trafic)

- ✅ **React `cache()`** sur les queries partagées — étendu 2026-06-16 : `getGroups`, `getFollowedGroupIds` (sidebar + page dans le même render) et `getEventBySlug` (`generateMetadata` + composant de `/mv/[slug]`, 2 requêtes → 1) wrappées `cache()`, en plus de `getGroupBySlug` (2026-06-15). **Root layout** (2026-06-16) : `profile` + `dialogGroups` passés en `Promise.all` (2 allers-retours séquentiels → concurrents). Reste possible (non bloquant) : helper `getViewer()` caché pour dédup `auth.getUser()` cross-composants — refactor plus large, repoussé.
- ✅ **Vitest : `environment: 'node'` par défaut** — fait 2026-06-16 : + `// @vitest-environment jsdom` sur `auth-menu.test.tsx` (seul test DOM). Suite ~19-29 s → **~6 s** (env cumulé 340 s → 3,6 s), 360 tests verts.

## P2 — Habitude & surfaces (utile à n=1)

- ✅ **Digest hebdo « Your k-pop week »** — fait 2026-07-04 : le lundi, le cron `send-digest` passe en édition hebdo (fenêtre 7 j, titre dédié) qui remplace la quotidienne ce jour-là (même cron, contrainte Hobby 1×/jour) ; `?edition=weekly` pour test manuel. Vérifié en réel (push reçus). Option e-mail non faite (resend non branché, volontaire).
- ✅ **Refonte landing** — faite avec la refonte Data Desk (2026-07-03) : grille de photos triée par notoriété YouTube + countdown temps réel + 3 étapes. L'item « mur de 173 noms » est obsolète.
- ✅ **Refonte home connectée** — faite avec la refonte Data Desk (2026-07-03) : home 8 modules (ticker, hero dernier MV, queue, week glance, fresh drops).
- ✅ **CSP en enforce (pragmatique)** — fait 2026-07-04 : header `Content-Security-Policy` en prod (report-only conservé en dev), `unsafe-eval` retiré en prod, fix `wss://*.supabase.co` (Realtime, trouvé par la vérif enforce). Vérifié : 0 violation sur 7 pages clés en prod. **Décision** : les nonces Next 16 forcent le rendu dynamique global (tue static/ISR) et `style-src` nonce est une impasse (attributs `style=""` React) → `unsafe-inline` script/style conservés ; l'enforce script-src complet (nonces) reste gated pré-ouverture publique.
- ✅ **Rate-limit robuste (atomique)** — fait 2026-07-04 (migration 0038) : RPC `consume_rate_limit` (SECURITY DEFINER + `pg_advisory_xact_lock`, table `rate_limit_hits` deny-all) branchée sur les 5 writes : postComment 5/60s, submitSuggestion+submitArtistSuggestion (bucket combiné 'suggestion') 10/24h, submitFeedback 2/24h, savePushSubscription **20/24h (nouveau, n'avait aucun cap)**. Atomicité vérifiée en prod (probe `tttff` cap 3, rollback). **Baseline advisors élargi (intentionnels)** : `rls_enabled_no_policy` sur rate_limit_hits (deny-all voulu) + `authenticated_security_definer_function_executable` sur consume_rate_limit (le mécanisme même) — s'ajoutent aux 3 acceptés (citext, group_follow_counts, profile_stats).

### UX polish différé (audit 2026-07-04 — écarts assumés, pas des oublis)

- **Page interne de visionnage des stages** (type `/mv` avec player embed) — aujourd'hui les bannières music_show ouvrent YouTube directement (icône lien externe affichée). À faire si les stage links prouvent leur usage.
- **Quick-tap ratings mobile** (presets à la place du slider) — le slider + bouton Save suffit pour l'instant.
- ✅ **Install hint iOS sur la home** — fait 2026-07-05 : `IosInstallHint` en fin de colonne centrale de la home connectée (auto-gated Safari iOS hors standalone). Vérifié par login E2E en UA iPhone.
- ✅ **Partage** — fait 2026-07-05 : `ShareButton` sur `/mv/[slug]` (top-right player) ; était déjà sur les fiches groupe/artiste. Écart assumé : pas sur les cartes event (root `<Link>`, bouton imbriqué invalide).

## Tests (accompagne P0/P1)

- ✅ **`slots.test.ts`** — fait 2026-06-16 : la logique créneaux hebdo KST (`nextWeeklySlotIso` rollover + tolérance 12 h ; `kstDateTimeToIso` KST→UTC + bornes invalides) est couverte (12 assertions, valeurs ISO calculées à la main confirmées au run).
- **E2E en CI** : le job existe (`ci.yml`, gated `vars.E2E_ENABLED`) — reste l'action GitHub UI **Rudy** (Settings → Secrets and variables → Actions) : variable `E2E_ENABLED=true` + secrets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`. ⚠️ Reco 2026-07-11 : créer un **compte test dédié** d'abord (les creds actuelles = compte perso tsuki48@). Une fois posé, vérifier que le job `e2e` apparaît ET passe au run suivant.
- ✅ **E2E `/search` + widget feedback** — fait 2026-07-04 : `search.spec.ts` (6 tests : hint, SSR ?q=, live debounce, segments, no-results, clear) + `feedback.spec.ts` (3 tests UI sans submit — pollution prod + cap 2/24h). 28/28 verts en local.
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
2. **Push personnalisés** — lead-times custom par type d'event (l'infra `user_notification_settings.lead_time_minutes` existe), rappels multiples (J-7 + J-1 + heure H). **Frontière posée 2026-07-05 (R1)** : le on/off par type est livré en free ; ce qui reste premium ici = les lead-times custom + multi-rappels.
3. **Export calendrier** — flux iCal / sync Google Calendar des events suivis (déclencheur d'abonnement classique des apps calendrier).
4. **Digest hebdo enrichi** — version email premium avec stats perso, teaser des drops de la semaine (l'infra send-digest existe).
5. **Stats avancées + Wrapped** — page stats perso approfondie (distribution des notes, streaks, genres) + le Wrapped annuel partageable en premium early-access.
6. **Thèmes exclusifs** — variantes de thème (couleurs de bias, thèmes par groupe) sur le socle de tokens existant.
7. **Badge profil premium** — signal social discret. ⚠️ **À construire entièrement** : `profiles.tier` n'est **rendu nulle part** côté profil aujourd'hui (vérifié R9 — `u/[username]/page.tsx` ne lit pas `tier`) ; seul le cap sidebar le consomme.
8. **Alertes mot-clé** — push sur mention d'un mot-clé dans les titres ingérés (« tour », « japan »…).

Paiement : Stripe Checkout + webhook → update `profiles.tier`. **Aucune migration DB requise** : le trigger `protect_profile_privileges` autorise DÉJÀ le service_role (`0017_phase1_schema.sql:42` — la garde est `auth.role() is distinct from 'service_role'`). Il « suffit » de la route checkout + webhook + UI. Préalable réel = compte Stripe de Rudy + choix des perks. Note R9 : `FREE_VISIBLE_FOLLOWS=10` est un cap d'**affichage** (sidebar), pas un vrai gate — suivre >10 reste possible ; le perk n°1 demande donc d'ajouter la limite dure.

## Roadmap R (actée 2026-07-05 — rétention/acquisition/monétisation)

- ✅ **R1 Boucle push** — fait 2026-07-05 (opt-in onboarding, deep link digest, préférences par type ; cf. JOURNAL).
- ✅ **R2 SEO programmatique** — fait 2026-07-05 : sitemap 1403 URLs, JSON-LD MusicGroup/VideoObject (+rating), metadata complètes, OG dynamiques version marque (cf. JOURNAL). Itérations possibles plus tard : OG photo+Archivo, retrait des artistes du sitemap si thin-content signalé. **Action Rudy post-deploy : soumettre le sitemap à Google Search Console** (propriété à créer si besoin).
- ✅ **R3 Export iCal** — fait 2026-07-05 : feed .ics par token (table `calendar_feeds`, générateur RFC 5545 pur, route cachée CDN, section /account avec Reset URL). V1 free intégral ; **premium futur = feeds filtrés multi-calendriers (par type/groupe), VALARM, fuseau forcé**. Cf. JOURNAL.
- ✅ **Doublons music_show en DB (cause racine)** — fait 2026-07-11 (migration 0040, cf. `SCRAPING.md §3.14`) : colonne dédiée `events.stage_url` (l'enrichissement n'écrit plus jamais dans source_url), 32 rows migrées, 16 doublons purgés (0 réf FK), **index unique partiel** `(group_id, start_at) where music_show` en garantie dure. Bonus : dédup same-source d'`ingestComebacks` (placeholder kpopofficial vs album finalisé, `§3.15`) + purge fromis_9/tripleS.
- **R4 Fond de roulement** — ✅ **self-host photos membres** fait 2026-07-11 (`clean-member-photos.ts` + `selfhost-member-photos.ts` : 14 photos FAUSSES nettoyées d'abord — graphiques calendrier kprofiles, photos du mauvais membre —, puis 492/492 rapatriées dans le bucket `member-photos`, 42 NULL sur fallback initiale). **Reste** : boucle contribution admin (hub `/admin`, édition avant approbation, push contributeur, policies édition/suppression par l'auteur — hors périmètre de l'opération 2026-07-11, décision Rudy « focus utilisateur final ») + polish home (Today/Tomorrow, « voir les N autres », agence).

## Restes du round 4 (2026-07-13)

- **KARD — dissolution annoncée le 2026-07-06** (dernier album 28/07, tournée d'adieu) : poser `groups.disbanded_on` quand la dissolution sera effective. BM/J.Seph ajoutés quand même (encore actifs).
- ~~**Membres décédés** (Jonghyun/SHINee, Moonbin/ASTRO)~~ → **FAIT R9 (2026-07-14)** : enum `member_status += 'deceased'` (0049), insertion des 2 (0050), photos fandom, rendu « In memoriam » (jamais « Former », non grisé) + section dédiée sur la page groupe. Décision Rudy actée (oui).
- **Photos membres fandom — mapping des titres** : 172/534 résolues au premier passage (titre « Stage Name (group) ») ; améliorer les candidats de titres (variantes de casse/désambiguïsation) pour les 362 restantes. La rotation quotidienne retente.
- **Debuts — file de revue** : 94 candidats `pending` sur `/admin/debuts` (gate de notabilité non franchi). Un coup d'œil de temps en temps suffit ; les 5 groupes créés sans chaîne YT vérifiée n'auront pas de MVs tant qu'une source n'est pas posée.
- **The Show (fallback SBS)** : board 64513 muet depuis nov. 2025, relance « SBS LiFE THE SHOW » le 14/07 — vérifier après le 14/07 si le post ep 394 apparaît, sinon relocaliser le board dans `sources/sbs-the-show.ts`.
- **Ères sous ancien nom** (BEAST→Highlight) et **solos de membres** (YEONJUN, KIHYUN — MVs sans nom du groupe dans le titre) : classes de MVs encore non couvertes par l'ingestion (documentées §3.19).

## Prévention découverte de chaînes (R7, 2026-07-13)

- **MVs sur chaîne d'agence** : les groupes debut auto-créés sont seedés avec leur seule chaîne perso — or les labels hébergent souvent les MVs (VAYONN→iNKODE corrigé + 6 autres). **À terme** : découverte périodique de chaînes pour tout groupe à catalogue fin (<3 MVs, debut_date récent) via `scripts/discover-mv-channels.ts`, seed auto des chaînes vérifiées (garde title-match). Pour l'instant : manuel quand signalé.
  - ✅ **R11 (2026-07-14)** : passe manuelle sur les 8 nouveaux groupes à 0 MV → `discover-mv-channels` puis seed umbrella (`youtube-channels.json`) + backfill = **65 MVs** (NEXZ/KickFlip→JYP, YOUNITE→BRANDNEW, POW→GRID, BADVILLAIN→BPM, Nowadays→NOWZ, n.SSign→propre, Candy Shop→Brave). Confirme que la découverte auto pour groupe à catalogue fin vaut le coup d'être automatisée.
- **Cas non résolus** (documentés) : CHASER (nom trop générique, aucune chaîne fiable au discover) ; SUCTION (MVs seulement sur 1theK dont la playlist uploads dépasse le cap API 20k — impaginables) ; MiiWAN (idole virtuelle, pas de chaîne officielle claire) ; AEN (pré-debut, 0 MV normal jusqu'au 05/08).

## Restes du round 8 (2026-07-14) — reportés en rounds dédiés

- ~~**Lot G — Éditeurs admin in-app**~~ → **FAIT R9 (2026-07-14)** : hub `/admin`, éditeur photo MEMBRE par URL (`/admin/images`, self-host + garde `photo_source_key='admin'`), éditeur titre MV + masquer-event (`/admin/events`, migration 0051 `events.hidden` + filtre display/search). `requireAdmin()` + `selfHostImage()` extraits. **Restes** : éditeur image GROUPE (image_url Spotify-managed → nécessiterait une garde `image_source` pour persister ; le banner editor couvre les bandeaux) ; cropper (recadrage) non fait — le self-host + faceCrop à l'affichage suffit.
- **Lot H — Abonnement premium 2,99€** (décision Rudy 2026-07-14 : avantages, **zéro pub**) : cf. section « Premium (V2+) » ci-dessus pour les perks candidats + l'intégration Stripe. **Round dédié** : nécessite compte Stripe + définition claire des perks, pas un lot polish.
- **Calendrier — nav de mois full-client** : les flèches restent une nav RSC (`<Link ?month>`), mais le levier lourd (refetch des ~150 groupes) est désormais caché (`getGroupsCached`) et les `<Link>` préfetchent. Le passage 100 % client (state + route handler caché) est un refactor à gain marginal → différé.
- **Weverse membres/groupes** : ajouté aux ENTRIES du `LinksBar` (icône prête) mais **saisie manuelle** — 0/150 groupes en base, aucune source structurée fandom (contrairement à `{{Instagram}}`). À remplir à la main via l'éditeur admin (Lot G) ou Supabase Studio.
- **Photos membres — restes (maj R9)** : split d'ère intra-groupe **résolu** (109→0 groupes mixtes, R8.1) ; solistes **12 → 1** (R9 : candidats désambiguïsés directs). **Reste Paul Kim** (aucun pageimage fandom → URL manuelle via `/admin/images`). Audit : `scripts/audit-member-photos.ts`.
- **Instagram groupes — restes** : 7 groupes sans IG (`select ... where links->>'instagram' is null and is_solo=false`) — 5 sous-unités/collabs (DK X Seungkwan, NCT JNJM, PJX, V8, ChaDongHyeop, sans IG dédié légitime) + **A.C.E et Highlight** (vrais groupes, pas de `{{Instagram}}` en infobox fandom → handles à poser à la main via `/admin/images`… non, via Studio/`groups.links`, l'éditeur admin ne fait que les photos membres).
- **Réseaux solistes — scan fait (R8.1)** : `scripts/scan-soloist-socials.ts` a diffé les 33 solistes contre l'infobox fandom. **Seule Lisa était fausse** (corrigée). 7 « mismatches » écartés (comptes perso officiels stockés vs comptes fan/agence/anciens sur fandom — NE PAS écraser). Solar/kiseo/suction = sous-remplis (backfill optionnel, sources fandom conflictuelles pour solar `solarkeem`/`solarsido` → ne pas deviner).

## Restes du round 10 (2026-07-14)

- ~~**Action Rudy — secret `CRON_SECRET` GitHub**~~ → **FAIT (2026-07-14)** : posé en secret repo Actions (via l'API, autorisé par Rudy — il l'avait mis au mauvais endroit). Le workflow `Scheduled scrapers` termine `success`. Music shows **restaurés** (curl direct + cron : 32 events, The Show ep 394 récupéré, carrd primaire OK sur les 6 shows sans fallback). Les crons quotidiens GH Actions tournent désormais.
- **⚠️ E2E réellement skippés en CI (découvert R10.1)** : le repo n'a **aucun secret/variable Actions au niveau repo** (à part `CRON_SECRET` posé). `ci.yml` gate l'E2E sur `vars.E2E_ENABLED == 'true'` qui n'existe pas → **les tests E2E ne s'exécutent pas** (le job est skippé, la CI passe quand même). Rudy croyait les avoir activés. À poser au bon endroit (Settings → Secrets and variables → Actions → Variables : `E2E_ENABLED=true` + Secrets : `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `E2E_AUTH_EMAIL/PASSWORD`) — avec un **compte test dédié** (creds actuelles = compte perso de Rudy).
- **Parsing carrd music-show** : à la vérif R10.1, le carrd primaire a parsé les 6 shows **sans fallback** (`primary_ok`, Music Bank/Inkigayo/The Show captés) → le problème « Music Bank via fallback / Inkigayo 0 » était **intermittent** (contenu carrd variable), pas systématique. À re-surveiller ; pas de fix urgent.
- **Rails sur le MV individuel** (`/mv/[slug]`) : différé (player full-bleed + comments realtime). `<PageRails>` réutilisable existe (appliqué à groupe + membre).
- ~~**Groupes créés R10 — compléter**~~ → **FAIT R11 (2026-07-14)** : photos membres (`refresh --stale`, 88+5), MVs des 8 groupes label-channel (65 via seed umbrella + backfill), 18 bannières YT, membres BADVILLAIN (7) + NOWZ (5) insérés (classifiés person-vs-song). **Restes R11** :
  - **7 membres sans photo** (BADVILLAIN Emma/INA/Vin/YunSeo, NOWZ Hyeonbin/Jinhyuk/Yeonwoo) : classe « page fandom sans pageimage » → non résoluble auto, saisie via `/admin/images`.
  - ✅ **NOWZ — renommé** (2026-07-14, demande Rudy) : `Nowadays`→`NOWZ` (name+slug+slugs membres). ⚠️ La photo n'était PAS le vrai blocage (pages NOWZ sans pageimage → `refresh --stale` = 0). **Coût du rename** : `matchesGroup` exige le nom dans le titre MV, or les MVs sont titrés « NOWADAYS(나우어데이즈) » → les **futurs MVs sur @cube_nowz ne s'attribueront plus** (4 en base saufs). **À faire** : soit ajouter un alias `NOWADAYS↔NOWZ` dans `group-match.ts` (mécanisme d'alias de groupe, réutilisable), soit backfill manuel à chaque sortie NOWZ. Alternative : revert du nom en « NOWADAYS » si le matching prime sur le libellé fandom.
  - **ARrC dissous** (fandom `years=2024–2026`, que des `former`) : optionnellement poser `disbanded_on` (pas de date précise trouvée) ; membres former non insérés. Groupe obscur, faible priorité.
  - **me:I** non ajouté (titre fandom différent).
- **Roster — catch-up automatique** : le gate backfillé (796 pages 2023-2026) crée ~12 groupes populaires/jour via le cron `scrape-comebacks`. Surveiller `/admin/debuts`. `ingestNamedGroups` pour tout ajout ciblé.

## Ops manuelles en attente

- ~~Re-scrape kprofiles des photos membres~~ → **remplacé 2026-07-05** par le self-host Supabase Storage (R4 ci-dessus) : régler la résilience et la fraîcheur en un seul geste.

## Reprises de l'ancien backlog (toujours pertinentes, non re-vérifiées par l'audit)

- **Admin hub** (`/admin`) : grille de liens vers les sous-sections.
- **Suggestions** : édition admin avant approbation ; édition/suppression par l'auteur (nécessite policies `update`/`delete` own-rows sur `event_suggestions`) ; notif push au contributeur (infra prête).
- **Music shows — repenser l'affichage** : ✅ **regroupement par épisode fait 2026-07-05** (1 carte par (show, date) avec lineup, toutes surfaces + digest ; `groupMusicShowEpisodes`, prédicat href-interne — cf. JOURNAL). Reste NON fait de l'idée d'origine : « le show comme entrée suivable » (follow d'un show, page d'épisode) — à cadrer si besoin réel.
- **Polish home** : groupage temporel (Aujourd'hui/Demain/Cette semaine), cap 10 events/bucket + « voir les N autres », champ agence incohérent (4 groupes seulement) — à re-trier au prochain passage sur la home.
- ✅ **Community pulse** — vérifié 2026-07-05 : déjà en place depuis mai (modal globale 3 tabs Artist/Event/Fix + toast succès sur les 3 forms, `suggest-event-dialog.tsx`). Un rapport d'agent le disait manquant — contre-vérifié par lecture directe, item clos sans code.

---

> Historique : l'ancien backlog (2026-05-30) et les plans exécutés sont archivés dans `docs/archive/` (git) ; l'item « Tests E2E à rafraîchir » était résolu depuis le 2026-05-30 et a été purgé.
