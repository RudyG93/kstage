-- Phase 6 — scrape_log a RLS activée mais aucune policy (advisor INFO
-- rls_enabled_no_policy). On rend le deny explicite : aucun accès client.
-- Le service role (cron scrapers) bypasse RLS pour écrire/lire les logs.
create policy "scrape_log: no client read" on public.scrape_log for select using (false);
