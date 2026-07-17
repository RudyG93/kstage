-- 0058 — Rows sources des 6 broadcasters music-show (Phase 3 Lot 4,
-- « provenance exacte des fallbacks »). Jusqu'ici, TOUS les events music_show
-- portaient la row carrd en source_id, même quand le lineup venait d'un
-- fallback broadcaster : la provenance était perdue. Le cron pose désormais
-- source_id = le provider RÉEL du lineup (lineup.sourceLabel → SourceScraper
-- .sourceUrl → row) ; `source_url` reste l'URL carrd (clé d'idempotence,
-- leçon 0040 — ne JAMAIS toucher une clé d'unicité pour de l'enrichissement).
-- URLs = miroir exact des `sourceUrl` des modules sources/*. Idempotent via
-- l'index partiel 0055. La row carrd est déjà versionnée (0014).

insert into public.sources (name, type, url)
values ('KBS Music Bank', 'music_shows', 'https://program.kbs.co.kr/2tv/enter/musicbank/pc/index.html')
on conflict (url) where group_id is null do nothing;

insert into public.sources (name, type, url)
values ('MBC Show! Music Core', 'music_shows', 'https://playvod.imbc.com/Templete/PreView?bid=1000788100000100000')
on conflict (url) where group_id is null do nothing;

insert into public.sources (name, type, url)
values ('Mnet M Countdown', 'music_shows', 'https://www.mnetplus.world/contents/en/shows/675aa046f350a1a1c97035b3/lineup')
on conflict (url) where group_id is null do nothing;

insert into public.sources (name, type, url)
values ('MBC M Show Champion', 'music_shows', 'https://m.imbc.com/program/1003864100000100000')
on conflict (url) where group_id is null do nothing;

insert into public.sources (name, type, url)
values ('SBS Inkigayo', 'music_shows', 'https://programs.sbs.co.kr/enter/gayo/boards/54772')
on conflict (url) where group_id is null do nothing;

insert into public.sources (name, type, url)
values ('SBS The Show', 'music_shows', 'https://programs.sbs.co.kr/fune/theshow/boards/64513')
on conflict (url) where group_id is null do nothing;
