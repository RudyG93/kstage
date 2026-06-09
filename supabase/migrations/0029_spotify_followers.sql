-- §4.3 — Nombre de followers Spotify par groupe. Sert de seuil pour élargir le
-- scope du scraping au-delà des 4 groupes MVP (cf. SCRAPING_MIN_SPOTIFY_FOLLOWERS).
-- Peuplé par le cron refresh-images (un seul search Spotify renvoie image + followers).
alter table public.groups add column if not exists spotify_followers integer;
