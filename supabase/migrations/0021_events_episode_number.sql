-- 5.2 — Numéro d'épisode des music shows (ex. "Inkigayo #328"). Le parsing
-- existe déjà (ParsedLineup.episodeNumber) ; on ajoute la colonne pour le
-- stocker à l'ingestion et l'afficher. Null pour les events non-music-show.
alter table public.events add column if not exists episode_number int;
comment on column public.events.episode_number is 'Music show episode number (e.g. Inkigayo #328). Null for non-music-show events.';
