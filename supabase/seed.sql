-- ============================================================
-- KStage — seed de développement (groupes réels + events fictifs).
-- Idempotent : ré-exécutable sans créer de doublons.
-- Appliqué via MCP execute_sql (hors migrations versionnées du schéma).
-- ============================================================

insert into groups (slug, name, agency, fandom_name, debut_date, color_hex) values
  ('aespa',       'aespa',       'SM Entertainment',   'MY',        '2020-11-17', '#FF1B6B'),
  ('illit',       'ILLIT',       'BELIFT LAB',         'GLLIT',     '2024-03-25', '#F5C6D6'),
  ('babymonster', 'BABYMONSTER', 'YG Entertainment',   'MONSTIEZ',  '2023-11-27', '#F2A900'),
  ('idle',       'i-dle',       'CUBE Entertainment', 'NEVERLAND', '2018-05-02', '#D4145A')
on conflict (slug) do nothing;

-- Note : le bloc INSERT INTO events fictif a été retiré (cf. feat/mv-discovery-
-- and-seed-cleanup). Les events viennent désormais uniquement du scraping
-- (YouTube + kpopofficial + community suggestions). Pour peupler une DB de
-- dev local, déclencher manuellement le cron /api/cron/scrape-youtube après
-- avoir seedé les sources ci-dessous.

-- Sources YouTube (étape 5)
-- Les handles @xxx sont à vérifier / corriger si besoin
insert into sources (name, url, type, group_id)
select 'aespa YouTube', 'https://www.youtube.com/@aespa', 'youtube_api', id
from groups where slug = 'aespa'
on conflict (url) do nothing;

insert into sources (name, url, type, group_id)
select 'ILLIT YouTube', 'https://www.youtube.com/@ILLIT_official', 'youtube_api', id
from groups where slug = 'illit'
on conflict (url) do nothing;

insert into sources (name, url, type, group_id)
select 'BABYMONSTER YouTube', 'https://www.youtube.com/@BABYMONSTER', 'youtube_api', id
from groups where slug = 'babymonster'
on conflict (url) do nothing;

insert into sources (name, url, type, group_id)
select 'i-dle YouTube', 'https://www.youtube.com/@official_i_dle', 'youtube_api', id
from groups where slug = 'idle'
on conflict (url) do nothing;

-- Chaînes d'agence (4.B.1) : la plupart des MVs k-pop sont publiés sur la
-- chaîne du label, pas celle du groupe. scrapeGroup() filtre par groups.name
-- (cf. group-match.ts) pour ne pas attraper les MVs des autres groupes signés
-- à la même agence.
insert into sources (name, url, type, group_id)
select 'aespa SMTOWN', 'https://www.youtube.com/@SMTOWN', 'youtube_api', id
from groups where slug = 'aespa'
on conflict (url) do nothing;

insert into sources (name, url, type, group_id)
select 'BABYMONSTER YG', 'https://www.youtube.com/@YGEntertainment', 'youtube_api', id
from groups where slug = 'babymonster'
on conflict (url) do nothing;

insert into sources (name, url, type, group_id)
select 'ILLIT HYBE LABELS', 'https://www.youtube.com/@HYBELABELS', 'youtube_api', id
from groups where slug = 'illit'
on conflict (url) do nothing;

insert into sources (name, url, type, group_id)
select 'i-dle United CUBE', 'https://www.youtube.com/@theunitedcube', 'youtube_api', id
from groups where slug = 'idle'
on conflict (url) do nothing;

-- Source comebacks (étape 7) — groupe-agnostique : le matching se fait en code.
insert into sources (name, url, type)
values ('kpopofficial comebacks', 'https://kpopofficial.com/kpop-comebacks/', 'kpopofficial')
on conflict (url) do nothing;

-- Source communautaire (étape 8) — attribution des events validés depuis les suggestions.
insert into sources (name, url, type)
values ('community suggestions', 'https://kstage.vercel.app/suggest', 'community')
on conflict (url) do nothing;
