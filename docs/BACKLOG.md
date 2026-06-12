# BACKLOG — KStage (roadmap active)

> **Réécrit le 2026-06-12** sur la base de l'audit complet (`docs/AUDIT_PROJET_2026-06-12.md`).
>
> **Direction actée (Rudy, 2026-06-12)** : pas de date de soft launch visée. Objectif = une **V1 assez bonne pour être fonctionnelle et retenir dès le premier utilisateur**. Le calendrier doit tenir sa promesse pour n'importe quel groupe qu'un fan suit — c'est le chantier prioritaire, avant tout polish.
>
> **Règle de gel** : toute feature dont la valeur dépend du **nombre** d'utilisateurs (feed d'activité, RSVP/compteur, votes, Wrapped, forum) est gelée jusqu'à une audience réelle. Toute feature utile à **n=1** (calendrier, push, countdowns, digest) est éligible.

---

## P0 — Data : tenir la promesse du calendrier

> Constat (audit §2) : 8 events futurs dans toute l'app, 82 % des groupes sans aucun event, 100 % du futur dépend de kpopofficial. C'est LE chantier — un calendrier vide ne retient personne, quelle que soit l'UX.

1. **Nettoyer la classification YouTube.**
   - Ne plus jamais déduire `release`/`concert` d'un upload YouTube (un upload = date de publication, pas date d'événement) → `other` ou skip.
   - Purger/reclasser les ~92 « release » promo (Official Audio, cheering guides, teasers, vlogs) et les 16 « concert » fantômes existants.
   - `notify-comebacks` pousse sur `['mv','release']` → re-vérifier le ciblage après nettoyage (risque de push erronées).
   - kpopofficial : poser `mv_kind:'main'` explicite à l'insert (6 events `mv` avec `mv_kind NULL` en prod contournent les filtres).
   - Backfiller les 6 events `mv` sans slug (injoignables via `/mv/[slug]`).
2. **Dédupliquer cross-chaînes.** La clé unique inclut `source_url` : dédup par **videoId YouTube** à l'ingestion (indépendamment de la chaîne) + purge des ~7 paires existantes (visibles dans « Recent comebacks » sur toutes les pages).
3. **Rendre le scraping observable.** Les 3 routes cron renvoient 200 même en échec total ; `scrape_log` existe mais 0 écriture ; `last_scraped_at` est mis à jour même sans récolte. → Contrat d'échec (500 si 0 source OK), écrire dans `scrape_log` (statut, counts, erreurs, rejets), conditionner `last_scraped_at` au succès. Sans ça, la mort de kpopofficial (notre seule source de futur) serait invisible indéfiniment.
4. **Réécrire le scraper YouTube sur `playlistItems.list`** (1 unit/chaîne vs 200 units/source actuellement avec 2× `search.list`). Prérequis bloquant de l'élargissement : à 173 groupes l'archi actuelle coûterait 3,5× le quota gratuit. Ajouter quota tracking + gestion `quotaExceeded`. Au passage : capter les **premieres programmées** (`liveBroadcastContent=upcoming` + `scheduledStartTime`) — aujourd'hui le scraper ne produit quasiment que du passé, les premieres sont le seul futur que YouTube peut donner.
5. **Élargir la couverture aux ~30-50 groupes les plus suivis.**
   - Seed des chaînes YouTube (officielle + agence) via le process de discovery (`SCRAPING.md §4`, oembed + Jina) — liste manuelle des tops (r/kpop, charts) sans attendre `spotify_followers`.
   - Backfill MV en **one-shot scripté** (pas en cron) une fois le coût quota réglé par le point 4.
   - Vérifier que le matching nom→groupe de kpopofficial capte bien tous les groupes en DB (23 couverts actuellement — investiguer les non-matchés).
   - Déclencher manuellement `GET /api/cron/refresh-images` (Bearer CRON_SECRET) pour peupler `spotify_followers` (0/173 au 2026-06-12), puis vérifier le cron du lundi.
6. **Aligner la promesse sur la data.** Étendre la logique « page pruning » (actée pour les membres) aux groupes : landing/onboarding/follow ne mettent en avant que les groupes avec de la data (event à venir ou récent) ; les groupes vides restent accessibles mais ne sont plus des dead-ends promus. Les anniversaires (96,9 % des birthdays en DB) servent de contenu plancher pour les groupes sans event.
7. **Casser le SPOF kpopofficial** : investiguer une 2ᵉ source de comebacks **annoncés** (le futur, pas le passé). Candidats à vérifier vivants d'abord (règle `feedback_data_sources`) : Reddit r/kpop comeback megathreads, comptes Twitter agrégateurs, Wikipedia « List of K-pop releases ». kpopofficial reste primaire.
8. **Music shows : visibilité au-delà de 24-48 h.** Vérifier le contenu brut du carrd : s'il publie la semaine, corriger le parser ; sinon documenter la limite dans `SCRAPING.md` (impact sur « ta semaine k-pop »).

## P1 — Quick wins (corrections vérifiées, effort faible)

### UX / SEO

- **Fix bouton « Sign up »** qui déborde de sa pastille sur desktop : `whitespace-nowrap` dans `src/components/auth/auth-menu.tsx` (bouton de conversion principal).
- **SEO pages groupes** : `generateMetadata` sur `groups/[slug]` (« aespa — comebacks & schedule · KStage »), `metadataBase`/canonical, title de la landing aligné sur l'og:title (actuellement « KStage » nu).
- **Labels anniversaires en anglais** (« turns 30 » au lieu de « 30 ans ») dans `src/lib/events/anniversaries.ts` + maj des 3 assertions de test.
- **Masquer « Recent discussions » sous un seuil** (1 seul thread affiché sur 3 pages = effet ville fantôme).
- **Cards Music Show** : `target=_blank` + icône external-link (elles sortent vers le carrd sans prévenir).
- **`/my`** : ajouter un redirect vers `/calendar` (vieux liens) — la page n'existe pas, le brief a été corrigé.

### Sécurité / ops

- **`getOpenReports` : ajouter `requireAdminUser()`** en 1ʳᵉ ligne (`src/lib/comments/moderation.ts`) — Server Action exposée qui lit la file de modération via service_role sans garde. Au passage, auditer tout export des fichiers `'use server'`.
- **3 toggles/migrations Supabase** : activer la leaked-password protection (dashboard) ; `revoke execute on function public.handle_new_user() from public;` (le revoke 0025 ne couvrait pas PUBLIC) ; resserrer les policies de listing des buckets `avatars`/`banners`.
- **Migration perf RLS** : `(select auth.uid())` sur les 22 policies flaggées + index sur les FK chaudes (`events.source_id` en premier). Mécanique, à faire en lot.
- **Réconcilier le ledger de migrations** : 0026-0030 appliquées hors tracking (`supabase migration repair` ou insertion des versions) — sinon un futur `db push` rejoue ou diverge.
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
