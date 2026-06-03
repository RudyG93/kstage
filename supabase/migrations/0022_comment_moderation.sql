-- 4.4 — Edit history + report pour les commentaires (système Reddit-like).

-- Historique d'édition : chaque édition archive l'ancien body (pour "View history").
create table if not exists public.comment_edit_history (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_body text not null,
  edited_at timestamptz not null default now()
);
create index if not exists comment_edit_history_comment_idx
  on public.comment_edit_history (comment_id, edited_at desc);
alter table public.comment_edit_history enable row level security;
create policy "comment_edit_history: readable by all"
  on public.comment_edit_history for select using (true);
create policy "comment_edit_history: insert own"
  on public.comment_edit_history for insert with check (auth.uid() = user_id);

-- Signalements : un user signale un commentaire ; l'admin traite via service role.
create table if not exists public.comment_report (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  unique (comment_id, reporter_id)
);
create index if not exists comment_report_status_idx
  on public.comment_report (status, created_at);
alter table public.comment_report enable row level security;
-- insert réservé au reporter ; lecture/modération via service role uniquement (pas de policy select).
create policy "comment_report: insert own"
  on public.comment_report for insert with check (auth.uid() = reporter_id);
