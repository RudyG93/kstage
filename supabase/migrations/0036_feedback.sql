-- Retours utilisateurs légers (bug / idée) — widget Feedback (2026-07-03).
-- Anti-spam/hack : auth requise, longueur bornée côté DB, rate-limit 2/24h
-- vérifié dans la server action (compte DB), RLS stricte (insert own only,
-- lecture réservée au service role / admin server-side).

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bug', 'idea')),
  body text not null check (char_length(body) between 10 and 500),
  page text check (char_length(page) <= 200), -- pathname d'où vient le retour
  status text not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now()
);

create index feedback_created_at_idx on public.feedback (created_at desc);
create index feedback_user_recent_idx on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

-- Un user authentifié n'insère que pour lui-même.
create policy "feedback_insert_own" on public.feedback
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Pas de policy SELECT/UPDATE/DELETE : lecture et modération passent par le
-- service role côté serveur (allowlist ADMIN_EMAILS), invisibles côté client.
