-- ============================================================
-- KStage — liens externes par groupe (phase 3, prep page artiste)
--   links = { spotify, deezer, apple_music, youtube, instagram, twitter, ... }
--   Rempli opportunément à l'import ; consommé par la future page artiste.
-- ============================================================

alter table groups add column if not exists links jsonb not null default '{}'::jsonb;
