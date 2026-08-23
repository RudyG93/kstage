-- ============================================================
-- KStage — journal des erreurs SERVEUR (audit produit 2026-08-23).
--   L'app n'avait AUCUNE visibilité sur ses erreurs de rendu :
--   une exception dans un Server Component, une Server Action
--   ou un route handler disparaissait dans les logs Vercel,
--   dont la rétention est courte et qu'aucun check ne lit.
--   `onRequestError` (src/instrumentation.ts) les pose ici.
--   Deny-all RLS comme product_events : écriture service-role,
--   lecture via /admin. Ni IP, ni User-Agent, ni corps de
--   requête — chemin, route et message seulement.
-- ============================================================

create table if not exists public.error_log (
  id bigint generated always as identity primary key,
  message text not null,
  digest text,
  path text,
  route_path text,
  route_type text,
  method text,
  stack text,
  created_at timestamptz not null default now()
);

create index if not exists error_log_created_idx on public.error_log (created_at desc);

alter table public.error_log enable row level security;

create policy "error_log: no client read"
  on public.error_log for select using (false);
