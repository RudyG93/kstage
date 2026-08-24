-- `groups.image_checked_at` — arrêter de redemander tous les jours ce qui ne
-- change jamais.
--
-- `refresh-images` interroge Spotify pour CHAQUE groupe portant un lien, tous
-- les jours : 173 appels. Rendement mesuré sur les 4 derniers runs réussis :
-- **0 à 4 images mises à jour**. Une photo d'artiste ne bouge pas d'un jour à
-- l'autre.
--
-- Et ce n'est pas gratuit : l'API Spotify a coupé deux fois ce mois-ci, dont
-- une avec `Retry-After: 45 635` — **12 h 40 de blocage** le 2026-08-21, qui a
-- fait sauter 254 groupes du run. C'est le plafond le plus bas de toute la
-- chaîne d'ingestion, bien avant le quota YouTube.
--
-- Avec un horodatage, le cron traite les moins récemment vérifiés : le roster
-- entier est couvert en quelques jours, pour un quart des appels, et la marge
-- récupérée finance l'élargissement du roster.
alter table public.groups add column if not exists image_checked_at timestamptz;

comment on column public.groups.image_checked_at is
  'Dernière interrogation Spotify pour l''image. Le cron refresh-images traite les plus anciens en premier ; NULL passe avant tout.';

-- Index partiel : la requête ne lit que les groupes qui ont un lien Spotify.
create index if not exists groups_image_checked_at_idx
  on public.groups (image_checked_at nulls first)
  where links ? 'spotify';
