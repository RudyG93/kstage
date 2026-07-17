-- Entité ÉPISODE de music show (Lot N 2026-07-17, demande Rudy : page épisode
-- avec logo, lineup, stages et commentaires). Jusqu'ici un épisode n'existait
-- qu'implicitement (N rows events groupées par title + jour KST à l'affichage)
-- — aucune ancre stable pour des commentaires (le cron purge/réconcilie des
-- rows events). Clé naturelle : un show n'a jamais deux épisodes le même jour
-- KST (même invariant que l'idempotence du scraper).

create table public.show_episodes (
  id uuid primary key default gen_random_uuid(),
  show_title text not null,
  kst_day date not null,
  episode_number int,
  start_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (show_title, kst_day)
);

-- Lecture publique (contenu éditorial) ; écriture réservée au service role
-- (cron scrape-music-shows) — aucune policy d'écriture.
alter table public.show_episodes enable row level security;
create policy "show_episodes_read" on public.show_episodes for select using (true);

-- Backfill : un épisode par (show, jour KST) déjà présent dans events.
insert into public.show_episodes (show_title, kst_day, episode_number, start_at)
select distinct on (title, (start_at at time zone 'Asia/Seoul')::date)
  title,
  (start_at at time zone 'Asia/Seoul')::date,
  episode_number,
  start_at
from public.events
where type = 'music_show'
order by title, (start_at at time zone 'Asia/Seoul')::date, created_at
on conflict do nothing;

-- Les commentaires acceptent désormais une cible épisode OU event (exactement
-- une des deux) — la RLS existante (own-rows par user_id) reste inchangée.
alter table public.comments add column episode_id uuid references public.show_episodes(id) on delete cascade;
alter table public.comments alter column event_id drop not null;
alter table public.comments add constraint comments_one_target check (num_nonnulls(event_id, episode_id) = 1);
create index comments_episode_id_idx on public.comments (episode_id) where episode_id is not null;
