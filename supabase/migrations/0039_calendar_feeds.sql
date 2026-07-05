-- Feed iCal par token-capability (R3, 2026-07-05). Table dédiée plutôt que
-- colonne sur profiles : profiles est SELECT-public (policy 0004 `using (true)`)
-- et RLS ne protège pas une colonne — un token sur profiles serait lisible par
-- tout client anon. Création lazy opt-in (pas de backfill, trigger signup
-- intact) ; la régénération d'un token fuité = simple UPDATE.

create table public.calendar_feeds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
-- `unique` crée l'index servant au lookup par token (route service-role).

alter table public.calendar_feeds enable row level security;

create policy "calendar_feeds: select own"
  on public.calendar_feeds for select
  using ((select auth.uid()) = user_id);

create policy "calendar_feeds: insert own"
  on public.calendar_feeds for insert
  with check ((select auth.uid()) = user_id);

-- Régénération (server action) : update du token uniquement sur sa ligne.
create policy "calendar_feeds: update own"
  on public.calendar_feeds for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
