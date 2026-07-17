-- Artistes des lineups music-show NON matchés au roster (retour Rudy
-- 2026-07-17 : « TRENDZ au Music Bank sans page — rajoutons les artistes
-- actifs »). Jusqu'ici ces noms n'existaient qu'en échantillon dans
-- scrape_log.details ; cette table les persiste avec un compteur de
-- récurrence pour alimenter une file de création dans /admin/debuts.
-- Alimentée par le cron scrape-music-shows (service role), décidée par
-- l'admin (Create via fandom / Ignore). Jamais d'auto-création.

create table public.lineup_unmatched (
  name_norm text primary key,
  display_name text not null,
  shows text[] not null default '{}',
  -- +1 par RUN où le nom apparaît (pas par show) : signal de récurrence.
  occurrences int not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'created', 'ignored'))
);

-- Deny-all : table interne (cron + admin server-only via service role).
-- Aucune policy → anon/authenticated ne lisent ni n'écrivent rien.
alter table public.lineup_unmatched enable row level security;
