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

- **Fix bouton « Sign up »** qui déborde de sa pastille sur desktop : `whitespace-nowrap` dans `src/components/auth/auth-menu.tsx` (bouton de conversion principal).
- **SEO pages groupes** : `generateMetadata` sur `groups/[slug]` (« aespa — comebacks & schedule · KStage »), `metadataBase`/canonical, title de la landing aligné sur l'og:title (actuellement « KStage » nu).
- ✅ **Labels anniversaires en anglais** (« turns 30 » au lieu de « 30 ans ») — fait 2026-06-15 avec P0.6 (`src/lib/events/anniversaries.ts` + 3 assertions).
- **Masquer « Recent discussions » sous un seuil** (1 seul thread affiché sur 3 pages = effet ville fantôme).
- **Cards Music Show** : `target=_blank` + icône external-link (elles sortent vers le carrd sans prévenir).
- **`/my`** : ajouter un redirect vers `/calendar` (vieux liens) — la page n'existe pas, le brief a été corrigé.

### Sécurité / ops

- **`getOpenReports` : ajouter `requireAdminUser()`** en 1ʳᵉ ligne (`src/lib/comments/moderation.ts`) — Server Action exposée qui lit la file de modération via service_role sans garde. Au passage, auditer tout export des fichiers `'use server'`.
- **3 toggles/migrations Supabase** : activer la leaked-password protection (dashboard) ; `revoke execute on function public.handle_new_user() from public;` (le revoke 0025 ne couvrait pas PUBLIC) ; resserrer les policies de listing des buckets `avatars`/`banners`.
- **Migration perf RLS** : `(select auth.uid())` sur les 22 policies flaggées + index sur les FK chaudes (`events.source_id` en premier). Mécanique, à faire en lot.
- ✅ **Ledger de migrations réconcilié** (2026-06-12, avec P0.3) : versions 0026-0030 insérées dans `supabase_migrations.schema_migrations`, 0031 appliquée via `apply_migration` (flux normal restauré).
- **Helper CRON_SECRET** centralisé : refuse si falsy + comparaison constante-temps (supprime le fallback `Bearer undefined` et la duplication ×6).
- **Hygiène code** : supprimer le code mort vérifié (`getMemberMvs`, `grouped-event-list.tsx`, `ui/card.tsx`, `ui/toggle.tsx`, `revalidatePath` doublé), corriger le commentaire périmé de `youtube-embed.tsx`.

### Perf (léger, avant trafic)

- **React `cache()`** sur les queries partagées (`getGroups`, `getFollowedGroupIds`, `getEventBySlug`, viewer/profile) + `Promise.all` dans le root layout — ~5-8 round-trips Supabase économisés par page authentifiée.
- **Vitest : `environment: 'node'` par défaut** + annotation jsdom sur `auth-menu.test.tsx` → suite de ~48 s à quelques secondes.

## P2 — Habitude & surfaces (utile à n=1)

- **Digest hebdo « ta semaine k-pop »** (push + option e-mail) — le hook d'habitude n°1 non livré ; n'a de la valeur qu'une fois P0 fait (sinon le digest est vide).
- **Refonte landing** : montrer le produit (aperçu calendrier/countdowns, grille de photos) au lieu du mur de 173 noms (`imgTotal=0` mesuré). Nécessaire avant toute exposition publique ; pas urgent tant que P0 n'est pas fait.
- **Refonte home connectée** (centre sparse) — reprendre l'item #9 de l'audit UX, sans le volet « feed » (gelé).
- **CSP en enforce** (retirer `unsafe-inline`/`unsafe-eval` via nonces Next 16) — avant toute ouverture publique.
- **Rate-limit robuste** (atomique) sur postComment/submitSuggestion/savePushSubscription — avant toute ouverture publique.

## Tests (accompagne P0/P1)

- **`slots.test.ts`** : la logique créneaux hebdo KST (rollover, tolérance 12 h, KST→UTC) utilisée par 6 sources n'a aucun test — la classe de bug la plus silencieuse du scraping.
- **E2E en CI** : job smoke (sans credentials) + secrets GitHub pour le golden path auth (aujourd'hui : jamais exécuté automatiquement).
- **Étendre le spec calendrier** : naviguer Next month + asserter qu'un event seedé s'affiche.
- **Fixture kpopofficial réelle** (capture datée via r.jina.ai) en plus du HTML synthétique — règle « real data over fixtures ».
- **Tests `artist-validation.ts`** (input communautaire public, 112 lignes non testées) + `normalizeUsername`.

## Risques à documenter (une demi-page, une fois)

- **r.jina.ai = SPOF gratuit** sur toute la couverture music shows + tension avec « respect robots.txt » → règle d'arbitrage à écrire.
- **Plafonds free tiers** : Vercel Hobby (usage non commercial, crons 1×/jour), Supabase free (MAU/egress) → triggers de bascule (~45 $/mois au total) à connaître avant le premier pic de trafic.
- **Burn-out solo** : 270 commits / 21 jours. Définir le « minimum maintenable » (les crons tournent seuls) pour pouvoir faire des pauses sans culpabilité.

## Gelé — gaté sur audience réelle

- Feed d'activité communautaire ; « j'attends ce comeback » (RSVP + compteur de hype) ; **KStage Wrapped** ; forum/modérateurs ; listes partageables ; reco « à suivre ». Un compteur à zéro est une anti-preuve sociale.
- Wiring des mocks home (`src/lib/mocks/home.ts` → vraies queries MV/Release of the month, Recent activity) — dépend d'une activité réelle.

## Reprises de l'ancien backlog (toujours pertinentes, non re-vérifiées par l'audit)

- **Admin hub** (`/admin`) : grille de liens vers les sous-sections.
- **Suggestions** : édition admin avant approbation ; édition/suppression par l'auteur (nécessite policies `update`/`delete` own-rows sur `event_suggestions`) ; notif push au contributeur (infra prête).
- **Music shows — repenser l'affichage** : un Music Bank à 8 groupes = 8 events redondants ; idée « le show comme entrée suivable » (titre = lineup). À cadrer.
- **Polish home** : groupage temporel (Aujourd'hui/Demain/Cette semaine), cap 10 events/bucket + « voir les N autres », champ agence incohérent (4 groupes seulement) — à re-trier au prochain passage sur la home.
- **Community pulse** : formulaire « Suggest event » en modal + « Suggest fix » + toast.

---

> Historique : l'ancien backlog (2026-05-30) et les plans exécutés sont archivés dans `docs/archive/` (git) ; l'item « Tests E2E à rafraîchir » était résolu depuis le 2026-05-30 et a été purgé.
