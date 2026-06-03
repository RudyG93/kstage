-- 4.3 — Suggestions d'artiste (Contribute → onglet Artist). Table dédiée car
-- une suggestion d'artiste ne rentre pas dans `event_suggestions` (pas de
-- group_id existant ni de start_at). L'admin approuve → insert groups (+members).
-- `members` = liste jsonb [{ name, position }].

create table if not exists public.artist_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('group', 'solo')),
  agency text,
  debut_date date,
  fandom_name text,
  color_hex text,
  image_url text,
  members jsonb not null default '[]'::jsonb,
  source_url text,
  status public.suggestion_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists artist_suggestions_status_idx
  on public.artist_suggestions (status, created_at);
alter table public.artist_suggestions enable row level security;
create policy "artist_suggestions: insert own"
  on public.artist_suggestions for insert with check (auth.uid() = user_id);
create policy "artist_suggestions: select own"
  on public.artist_suggestions for select using (auth.uid() = user_id);
