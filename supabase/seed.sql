-- ============================================================
-- KStage — seed de développement (base de dev minimale : 4 groupes réels
-- + leurs sources YouTube). Idempotent : ré-exécutable sans doublons.
-- Rejoué par `supabase db reset` (job CI « DB », .github/workflows/db.yml).
--
-- Les sources STRUCTURELLES (kpopofficial, community, wikipedia, music_shows)
-- vivent dans les migrations (0014, 0056) : une base fraîche les a toujours,
-- le seed n'en porte plus. Les events viennent du scraping (déclencher
-- /api/cron/scrape-youtube après seed pour peupler une DB de dev).
-- ============================================================

insert into groups (slug, name, agency, fandom_name, debut_date, color_hex) values
  ('aespa',       'aespa',       'SM Entertainment',   'MY',        '2020-11-17', '#FF1B6B'),
  ('illit',       'ILLIT',       'BELIFT LAB',         'GLLIT',     '2024-03-25', '#F5C6D6'),
  ('babymonster', 'BABYMONSTER', 'YG Entertainment',   'MONSTIEZ',  '2023-11-27', '#F2A900'),
  ('idle',       'i-dle',       'CUBE Entertainment', 'NEVERLAND', '2018-05-02', '#D4145A')
on conflict (slug) do nothing;

-- Sources YouTube par groupe (data, pas structurel). La cible ON CONFLICT est
-- la contrainte sources_url_group_unique (0033) — l'ancien `on conflict (url)`
-- échouait depuis que unique(url) a été supprimée (audit §9.2).
insert into sources (name, url, type, group_id)
select 'aespa YouTube', 'https://www.youtube.com/@aespa', 'youtube_api', id
from groups where slug = 'aespa'
on conflict (url, group_id) do nothing;

insert into sources (name, url, type, group_id)
select 'ILLIT YouTube', 'https://www.youtube.com/@ILLIT_official', 'youtube_api', id
from groups where slug = 'illit'
on conflict (url, group_id) do nothing;

insert into sources (name, url, type, group_id)
select 'BABYMONSTER YouTube', 'https://www.youtube.com/@BABYMONSTER', 'youtube_api', id
from groups where slug = 'babymonster'
on conflict (url, group_id) do nothing;

insert into sources (name, url, type, group_id)
select 'i-dle YouTube', 'https://www.youtube.com/@official_i_dle', 'youtube_api', id
from groups where slug = 'idle'
on conflict (url, group_id) do nothing;

-- Chaînes d'agence (4.B.1) : la plupart des MVs k-pop sont publiés sur la
-- chaîne du label, pas celle du groupe. scrapeGroup() filtre par groups.name
-- (cf. group-match.ts) pour ne pas attraper les MVs des autres groupes signés
-- à la même agence.
insert into sources (name, url, type, group_id)
select 'aespa SMTOWN', 'https://www.youtube.com/@SMTOWN', 'youtube_api', id
from groups where slug = 'aespa'
on conflict (url, group_id) do nothing;

insert into sources (name, url, type, group_id)
select 'BABYMONSTER YG', 'https://www.youtube.com/@YGEntertainment', 'youtube_api', id
from groups where slug = 'babymonster'
on conflict (url, group_id) do nothing;

insert into sources (name, url, type, group_id)
select 'ILLIT HYBE LABELS', 'https://www.youtube.com/@HYBELABELS', 'youtube_api', id
from groups where slug = 'illit'
on conflict (url, group_id) do nothing;

insert into sources (name, url, type, group_id)
select 'i-dle United CUBE', 'https://www.youtube.com/@theunitedcube', 'youtube_api', id
from groups where slug = 'idle'
on conflict (url, group_id) do nothing;
