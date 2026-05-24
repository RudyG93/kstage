-- ============================================================
-- KStage — schéma initial
-- Principes :
--   - Tables publiques (groups, members, events, sources)
--     en lecture libre, écriture admin only (RLS en 0002).
--   - Tables user (user_follows, user_notification_settings,
--     event_suggestions, push_subscriptions) en RLS strict
--     (user n'accède qu'à ses propres lignes).
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type event_type as enum (
  'comeback', 'music_show', 'live', 'anniversary', 'concert', 'other'
);
create type event_status as enum ('confirmed', 'tentative', 'cancelled');
create type suggestion_status as enum ('pending', 'approved', 'rejected');

-- Groups
create table groups (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  agency text,
  fandom_name text,
  debut_date date,
  color_hex text,
  image_url text,
  created_at timestamptz not null default now()
);

-- Members
create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  stage_name text not null,
  real_name text,
  birthday date,
  position text,
  created_at timestamptz not null default now()
);
create index on members(group_id);

-- Sources (pour scraping log)
create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  type text not null, -- 'youtube_api' | 'dbkpop' | 'manual' | ...
  last_scraped_at timestamptz,
  created_at timestamptz not null default now()
);

-- Events
create table events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  type event_type not null,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  status event_status not null default 'confirmed',
  source_id uuid references sources(id),
  source_url text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotence : empêche le scraping de créer des doublons
  unique (group_id, type, start_at, source_url)
);
create index on events(start_at);
create index on events(group_id, start_at);
create index on events(type, start_at);

-- User follows
create table user_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);
create index on user_follows(group_id);

-- User notification settings
create table user_notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type event_type not null,
  lead_time_minutes int not null default 1440, -- J-1 par défaut
  channel text not null default 'push',
  enabled boolean not null default true,
  unique (user_id, event_type, channel)
);
create index on user_notification_settings(user_id);

-- Event suggestions (modération communautaire — étape 8)
create table event_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references groups(id),
  type event_type not null,
  title text not null,
  description text,
  start_at timestamptz not null,
  source_url text,
  status suggestion_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on event_suggestions(status, created_at desc);

-- Push subscriptions (Web Push — étape 6)
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
