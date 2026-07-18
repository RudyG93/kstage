-- 0062 — Rotation de re-scan PROFOND des sources YouTube (round 2026-07-18).
-- Le cron quotidien ne lit que les 2 premières pages d'uploads : un MV ancien
-- (upload raté, trou d'historique, chaîne label seedée après coup) restait
-- invisible pour toujours — 41 groupes actifs à ≤1 MV (UNIS à 4). Le cron
-- re-pagine désormais à fond les N sources les plus anciennement deep-scannées
-- par run (cycle ~hebdo), horodatées ici.
alter table sources
  add column if not exists last_deep_scan_at timestamptz;

comment on column sources.last_deep_scan_at is
  'Dernier re-scan profond (pagination complète) par le cron scrape-youtube — rotation oldest-first.';
