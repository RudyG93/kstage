-- §7 — Log d'idempotence des push datés par comeback. Une ligne = un trigger
-- (announced / day_before / day_of) déjà envoyé à un user pour un event donné.
-- L'unique(user_id, event_id, kind) garantit qu'un même trigger n'est jamais
-- ré-envoyé, peu importe combien de fois le cron `notify-comebacks` tourne.
create table event_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, event_id, kind)
);

-- Écrit/lu uniquement par le cron (service role, bypass RLS). Aucun accès client :
-- RLS activée + deny explicite, même pattern que scrape_log (0024).
alter table event_notifications enable row level security;
create policy "event_notifications: no client read"
  on public.event_notifications for select using (false);
