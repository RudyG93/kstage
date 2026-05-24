-- ============================================================
-- Row Level Security
--   - Tables contenu : lecture publique, écriture service_role only
--     (le service_role bypass RLS → utilisé par les cron jobs).
--   - Tables user : accès strict aux propres lignes (auth.uid()).
-- ============================================================

-- Tables contenu : lecture publique
alter table groups enable row level security;
alter table members enable row level security;
alter table events enable row level security;
alter table sources enable row level security;

create policy "groups readable by all"
  on groups for select using (true);
create policy "members readable by all"
  on members for select using (true);
create policy "events readable by all"
  on events for select using (true);
create policy "sources readable by all"
  on sources for select using (true);

-- Tables user : accès strict à ses propres lignes
alter table user_follows enable row level security;
alter table user_notification_settings enable row level security;
alter table event_suggestions enable row level security;
alter table push_subscriptions enable row level security;

create policy "user_follows: own rows"
  on user_follows for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_notification_settings: own rows"
  on user_notification_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "event_suggestions: own rows select"
  on event_suggestions for select
  using (auth.uid() = user_id);
create policy "event_suggestions: own rows insert"
  on event_suggestions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions: own rows"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
