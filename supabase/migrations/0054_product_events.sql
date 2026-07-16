-- 0054 — Analytics produit first-party (Phase 2, audit §10.3). Les ~17 events
-- du funnel d'activation + la north-star « calendar_opened » (actifs hebdo qui
-- ouvrent leur calendrier perso). Deny-all RLS : écriture service-role
-- uniquement (server actions + POST /api/e), lecture via /admin (service role).
--
-- Vie privée : ni IP ni User-Agent. user_id FK `on delete set null` = la
-- suppression du compte anonymise les lignes sans détruire les agrégats.
-- anon_id = UUID aléatoire d'un cookie first-party (non fingerprintable).
--
-- Dédup par day_key, politique CÔTÉ SERVEUR (src/lib/analytics/events.ts) :
--   'YYYY-MM-DD' (UTC) = 1 row/user/jour (north-star) ; 'once' = jalon à vie
--   (signup_completed, first/three_groups_followed…) ; null = pas de dédup.
-- Vocabulaire fermé par CHECK : ajouter un event = une migration (garde-fou
-- anti-prolifération).

create table public.product_events (
  id bigint generated always as identity primary key,
  event text not null check (event in (
    'landing_cta_clicked',
    'signup_started',
    'signup_completed',
    'onboarding_started',
    'first_group_followed',
    'three_groups_followed',
    'personal_calendar_ready',
    'push_prompt_shown',
    'push_permission_granted',
    'push_permission_denied',
    'push_permission_unavailable',
    'notification_opened',
    'notification_type_disabled',
    'ical_enabled',
    'search_no_results',
    'feedback_submitted',
    'calendar_opened'
  )),
  user_id uuid references auth.users (id) on delete set null,
  anon_id uuid,
  day_key text, -- 'YYYY-MM-DD' | 'once' | null (cf. DEDUPE_POLICY)
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index product_events_event_created_idx
  on public.product_events (event, created_at desc);

-- Dédup daily/once par user (les events anonymes ne sont pas dédupliqués).
create unique index product_events_user_dedup_idx
  on public.product_events (user_id, event, day_key)
  where user_id is not null and day_key is not null;

alter table public.product_events enable row level security;

create policy "product_events: no client read"
  on public.product_events for select using (false);
