# BACKLOG — KStage

Idées d'amélioration différées **post-MVP** (cf. roadmap `PROJECT.md §6`, vision V2 `§10`).
On finit l'étape 9 (polish + lancement) avant d'attaquer ces points ; le feedback réel re-priorisera.

## Suggestions communautaires (suite de l'étape 8)

- **Édition admin d'une suggestion** — permettre à l'admin de corriger une suggestion (titre, date, type…) avant de l'approuver, au lieu de seulement approuver/rejeter. Nouveau flux : formulaire d'édition côté `/admin/suggestions` + action `updateSuggestion` (service_role).
- **Gestion par l'utilisateur de ses suggestions** :
  - Icône poubelle pour **supprimer** sa propre suggestion (même en `pending`).
  - **Éditer** sa suggestion tant qu'elle est `pending`.
  - **Auto-expiration** dans « My suggestions » : masquer/effacer les suggestions `approved`/`rejected` au bout d'1 semaine (la partie « masquer » est un simple filtre sur `reviewed_at` ; l'effacement réel nécessiterait un cron ou un delete).
  - ⚠️ **Nécessite une migration** : la RLS de `event_suggestions` n'autorise aujourd'hui que `select`/`insert` sur ses propres lignes — il faut ajouter des policies `update` et `delete` (own rows, restreintes au statut `pending` pour l'update).
- **Notif push au contributeur** (reportée à l'étape 8) — prévenir l'auteur quand sa suggestion est approuvée/rejetée. Infra push (étape 6) déjà en place.

## Types d'events

- **Concert** (et éventuellement d'autres types) — réintroduire quand pertinent : rajouter à `FILTERABLE_EVENT_TYPES` (`src/lib/events/labels.ts`), au scraper YouTube, et au formulaire de suggestion (tout s'aligne sur cette constante).

## Scraping / récupération de données

> ⚠️ **Revue dédiée prévue post-MVP** (avec Rudy) : faire le point sur tout le système de scrape/récup avant de l'étendre. Objectifs : **bien capter ce qui est important pour _n'importe quel_ groupe** ajouté à l'app (pas seulement les 4 actuels), et **garantir zéro doublon** (idempotence robuste entre sources). Rudy validera/modifiera l'approche à ce moment-là.

- **YouTube premieres via l'API officielle** — remplacer la détection actuelle (uploads récents `search?order=date` + mots-clés) par `liveStreamingDetails.scheduledStartTime` + `liveBroadcastContent=upcoming` pour capter les **vraies premieres programmées** (futures, datées) plutôt que des uploads passés.
- **Enrichir `detectEventType`** (`src/lib/scrapers/youtube.ts`) — insight Rudy : les clips/comebacks contiennent quasi toujours **« MV »** (et « M/V », « Official Video ») une fois sortis. Ajouter ces mots-clés améliorerait la détection comeback. Différé : on garde simple au MVP (les comebacks sont déjà couverts par kpopofficial).

## Vision V2 (étoile polaire — cf. `PROJECT.md §10`)

- Ratings + commentaires par comeback/MV (beachhead communautaire).
- Forum, votes topics/messages, modérateurs bénévoles (gatés sur trafic réel).
