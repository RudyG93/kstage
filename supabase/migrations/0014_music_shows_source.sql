-- ============================================================
-- 0014_music_shows_source.sql
-- Seed la source row pour le scraper /api/cron/scrape-music-shows
-- qui agrège les 6 music shows hebdo (The Show, Show Champion, M Countdown,
-- Music Bank, Music Core, Inkigayo) depuis liveshowupdatess.carrd.co.
-- Idempotent : ON CONFLICT (url) DO NOTHING.
-- ============================================================

insert into sources (name, type, url)
values ('Live Show Updates', 'music_shows', 'https://liveshowupdatess.carrd.co/')
on conflict (url) do nothing;
