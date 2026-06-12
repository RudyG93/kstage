-- P0.3 observabilité scraping : compteurs/erreurs par run de cron.
-- (inserted/skipped par source, pages fetchées, erreurs — la signature
-- d'échec typique « page 200 mais 0 entrée parsée » a besoin des counts.)
-- RLS : scrape_log est déjà deny-all (0024) ; seuls les crons (service_role)
-- écrivent.
alter table public.scrape_log add column details jsonb;
