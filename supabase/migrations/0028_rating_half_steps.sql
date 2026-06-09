-- Notation : passage de l'échelle 1–10 entière à 0–10 par pas de 0.5 (§1).
-- Les valeurs existantes (1–10) restent valides sur la nouvelle échelle.
-- Le CHECK impose [0,10] et un multiple de 0.5 (score*2 entier).

alter table public.event_ratings drop constraint if exists event_ratings_score_check;

alter table public.event_ratings
  alter column score type numeric(3, 1) using score::numeric(3, 1);

alter table public.event_ratings
  add constraint event_ratings_score_check
  check (score >= 0 and score <= 10 and (score * 2) = floor(score * 2));
