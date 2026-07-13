-- R4-I (2026-07-13) : auto-découverte des debuts.
-- Staging des groupes détectés sur kpop.fandom (Category:{YYYY}_debuts) avant
-- auto-création. Idempotence par fandom_pageid. Les candidats qui passent le
-- gate (date concrète + signal de notabilité) sont créés automatiquement ;
-- les autres attendent un coup d'œil admin (/admin/debuts).
--
-- RLS deny-all : table interne, lue/écrite uniquement en service_role (crons +
-- pages admin server-side) — même modèle que scrape_log (migration 0024).

create table public.debut_candidates (
  id uuid primary key default gen_random_uuid(),
  fandom_pageid integer not null unique,
  page_title text not null,
  status text not null default 'pending' check (status in ('pending', 'created', 'dismissed')),
  -- Payload parsé de l'infobox : {name, debutDate, label, members[], youtubeHandle,
  -- instagram, imageUrl, wikipediaListed, reason?…} — sert à la revue admin et
  -- à la re-création manuelle sans re-fetch.
  payload jsonb,
  group_id uuid references public.groups(id) on delete set null,
  detected_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.debut_candidates enable row level security;
-- Aucune policy : deny-all pour anon/authenticated, service_role passe outre.
