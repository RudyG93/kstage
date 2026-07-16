-- 0053 — Idempotence du digest push (Phase 1 Lot 4, audit « idempotence des
-- digests »). Avant : aucun log d'envoi, un re-run du cron send-digest
-- renvoyait le digest à tout le monde (mitigé seulement par le tag côté OS).
-- Une ligne par (user, jour UTC du run, édition) réellement servi ; le cron
-- filtre les users déjà servis puis insère après envoi. Granularité par USER
-- (pas par run) : un run interrompu à mi-course se relance sans double-envoi
-- pour les users déjà servis, sans priver les autres.

create table digest_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key text not null, -- date UTC du run 'YYYY-MM-DD' (envoi global 1×/jour)
  edition text not null, -- 'daily' | 'weekly'
  sent_at timestamptz not null default now(),
  unique (user_id, day_key, edition)
);

-- Deny-all : seuls les crons en service_role lisent/écrivent (pattern
-- event_notifications 0030 + scrape_log 0024). Policy SELECT explicite pour
-- solder l'advisor « RLS enabled no policy ».
alter table digest_log enable row level security;

create policy "digest_log: no client read" on public.digest_log for select using (false);
