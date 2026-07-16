-- 0056 — Sources STRUCTURELLES versionnées (Phase 3 Lot 1, audit §9.2).
-- Structurelle = une row dont l'absence fait échouer (500) ou skipper
-- silencieusement un cron. Jusqu'ici ces rows n'existaient qu'en prod,
-- insérées à la main via MCP : une base fraîche perdait le scraper
-- kpopofficial (500), l'attribution des suggestions communautaires et le
-- fallback anti-SPOF Wikipedia (skip silencieux — le trou pointé par
-- l'audit). `music_shows` est déjà versionnée (0014).
--
-- name/url = MIROIR EXACT des rows prod existantes (vérifié avant apply) :
-- un libellé différent créerait une 2ᵉ row du même type et casserait le
-- `.maybeSingle()` du cron scrape-comebacks. Idempotent via l'index partiel
-- 0055. Les sources YouTube par groupe restent de la DATA (seed.sql/scripts).

insert into public.sources (name, type, url)
values ('kpopofficial comebacks', 'kpopofficial', 'https://kpopofficial.com/kpop-comebacks/')
on conflict (url) where group_id is null do nothing;

insert into public.sources (name, type, url)
values ('community suggestions', 'community', 'https://kstage.vercel.app/suggest')
on conflict (url) where group_id is null do nothing;

insert into public.sources (name, type, url)
values ('Wikipedia — South Korean music releases', 'wikipedia', 'https://en.wikipedia.org/wiki/2026_in_South_Korean_music')
on conflict (url) where group_id is null do nothing;
