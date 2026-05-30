-- ============================================================
-- KStage — Phase 1 finalisation : fondations schéma
--   - profiles : tier/role/timezone/bias/favorite (colonnes pour
--     phases 2-3, nullable ou défaut → additif, safe en prod).
--   - protect_profile_privileges : empêche un user d'élever son
--     propre role/tier via la policy "profiles: update own". Seul
--     service_role peut les modifier (admin/billing côté serveur).
--   - mv_like : like binaire sur un MV (= event type 'mv'), distinct
--     du vote /10 (event_ratings). Cf. §3.6.
--   - monthly_winner : gagnant mensuel MV/Release calculé par cron
--     (algo bayésien), lu en cache par l'app. Cf. §3.1.
--   - scrape_log : diagnostics scraper, réservé service_role. Cf. §5.1.
-- ============================================================

-- ------------------------------------------------------------
-- profiles : colonnes fondations (tier, role, timezone, bias, favorite)
-- ------------------------------------------------------------
create type tier_type as enum ('free', 'premium');
create type user_role as enum ('user', 'admin', 'moderator');

alter table profiles
  add column tier tier_type not null default 'free',
  add column role user_role not null default 'user',
  add column timezone text,  -- IANA (ex 'Europe/Paris'), null = fallback côté app
  add column bias_member_id uuid references members(id) on delete set null,
  add column favorite_group_id uuid references groups(id) on delete set null;

-- ------------------------------------------------------------
-- Garde-fou anti-escalade : role/tier non modifiables par le user
--   La policy "profiles: update own" (0004) autorise un user à
--   UPDATE sa propre ligne, donc potentiellement role='admin' /
--   tier='premium'. Ce trigger fige ces deux colonnes hors
--   service_role. Pas de SECURITY DEFINER : on mute seulement NEW,
--   aucun accès cross-privilège requis (moindre privilège).
-- ------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.role := old.role;
    new.tier := old.tier;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileges
  before update on profiles
  for each row execute function public.protect_profile_privileges();

-- ------------------------------------------------------------
-- mv_like : like binaire par user × MV (event type 'mv')
--   PK composite (pattern comment_votes 0009). Présence = liké.
-- ------------------------------------------------------------
create table mv_like (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index on mv_like (event_id);

alter table mv_like enable row level security;

create policy "mv_like: readable by all"
  on mv_like for select using (true);
create policy "mv_like: insert own"
  on mv_like for insert with check (auth.uid() = user_id);
create policy "mv_like: delete own"
  on mv_like for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- monthly_winner : gagnant mensuel MV / Release (cron, algo bayésien)
--   type réutilise l'enum event_type ('mv' | 'release').
--   Lecture publique ; écriture service_role uniquement (cron).
-- ------------------------------------------------------------
create table monthly_winner (
  id uuid primary key default gen_random_uuid(),
  type event_type not null,
  period_month date not null,  -- 1er jour du mois calculé
  winner_event_id uuid not null references events(id) on delete cascade,
  score numeric not null,      -- score bayésien retenu (traçabilité)
  computed_at timestamptz not null default now(),
  unique (type, period_month)
);

alter table monthly_winner enable row level security;

create policy "monthly_winner: readable by all"
  on monthly_winner for select using (true);
-- Écriture : aucune policy → seul service_role (qui bypass RLS) insère.

-- ------------------------------------------------------------
-- scrape_log : diagnostics des runs de scraping (§5.1)
--   Réservé service_role : aucune policy → invisible côté client.
-- ------------------------------------------------------------
create table scrape_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null,  -- 'success' | 'error' | 'partial'
  error_msg text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on scrape_log (source, started_at desc);

alter table scrape_log enable row level security;
-- Aucune policy : lecture/écriture réservées au service_role.
