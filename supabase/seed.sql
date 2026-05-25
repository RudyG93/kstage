-- ============================================================
-- KStage — seed de développement (groupes réels + events fictifs).
-- Idempotent : ré-exécutable sans créer de doublons.
-- Appliqué via MCP execute_sql (hors migrations versionnées du schéma).
-- ============================================================

insert into groups (slug, name, agency, fandom_name, debut_date, color_hex) values
  ('aespa',       'aespa',       'SM Entertainment',   'MY',        '2020-11-17', '#FF1B6B'),
  ('illit',       'ILLIT',       'BELIFT LAB',         'GLLIT',     '2024-03-25', '#F5C6D6'),
  ('babymonster', 'BABYMONSTER', 'YG Entertainment',   'MONSTIEZ',  '2023-11-27', '#F2A900'),
  ('gidle',       '(G)I-DLE',    'CUBE Entertainment', 'NEVERLAND', '2018-05-02', '#D4145A')
on conflict (slug) do nothing;

with g as (select id, slug from groups)
insert into events (group_id, type, title, start_at, status, source_url) values
  -- aespa
  ((select id from g where slug='aespa'),       'comeback',    'aespa — new mini album',        '2026-06-15 09:00+00', 'confirmed', 'https://example.com/aespa-comeback-0615'),
  ((select id from g where slug='aespa'),       'music_show',  'M Countdown',                   '2026-05-29 11:00+00', 'confirmed', 'https://example.com/aespa-mcd-0529'),
  ((select id from g where slug='aespa'),       'live',        'aespa — Weverse Live',          '2026-05-25 12:00+00', 'confirmed', null),
  ((select id from g where slug='aespa'),       'anniversary', 'aespa — debut anniversary',     '2025-11-17 00:00+00', 'confirmed', null),
  ((select id from g where slug='aespa'),       'music_show',  'Music Bank',                    '2026-06-19 08:00+00', 'tentative', null),
  -- ILLIT
  ((select id from g where slug='illit'),       'comeback',    'ILLIT — 2nd single album',      '2026-07-08 09:00+00', 'confirmed', 'https://example.com/illit-comeback-0708'),
  ((select id from g where slug='illit'),       'music_show',  'Inkigayo',                      '2026-06-01 06:00+00', 'confirmed', null),
  ((select id from g where slug='illit'),       'live',        'ILLIT — YouTube premiere',      '2026-07-08 09:00+00', 'confirmed', 'https://youtube.com/illit-premiere'),
  ((select id from g where slug='illit'),       'anniversary', 'ILLIT — debut anniversary',     '2026-03-25 00:00+00', 'confirmed', null),
  -- BABYMONSTER
  ((select id from g where slug='babymonster'), 'comeback',    'BABYMONSTER — 1st full album',  '2026-06-27 09:00+00', 'confirmed', 'https://example.com/bm-comeback-0627'),
  ((select id from g where slug='babymonster'), 'music_show',  'Show Champion',                 '2026-07-01 09:30+00', 'confirmed', null),
  ((select id from g where slug='babymonster'), 'anniversary', 'BABYMONSTER — debut anniversary', '2025-11-27 00:00+00', 'confirmed', null),
  ((select id from g where slug='babymonster'), 'live',        'BABYMONSTER — Weverse Live',    '2026-05-31 11:00+00', 'tentative', null),
  -- (G)I-DLE
  ((select id from g where slug='gidle'),       'comeback',    '(G)I-DLE — 9th mini album',     '2026-07-21 09:00+00', 'tentative', 'https://example.com/gidle-comeback-0721'),
  ((select id from g where slug='gidle'),       'music_show',  'The Show',                      '2026-07-22 09:00+00', 'tentative', null),
  ((select id from g where slug='gidle'),       'live',        '(G)I-DLE — V Live special',     '2026-06-05 12:00+00', 'confirmed', null),
  ((select id from g where slug='gidle'),       'anniversary', '(G)I-DLE — debut anniversary',  '2026-05-02 00:00+00', 'confirmed', null),
  ((select id from g where slug='gidle'),       'music_show',  'Music Core',                    '2026-07-25 07:00+00', 'tentative', null),
  -- événements passés (pour tester le filtrage "upcoming")
  ((select id from g where slug='aespa'),       'comeback',    'aespa — previous single',       '2026-02-10 09:00+00', 'confirmed', 'https://example.com/aespa-old-0210'),
  ((select id from g where slug='illit'),       'music_show',  'Music Bank (rerun)',            '2026-04-18 08:00+00', 'confirmed', null)
on conflict (group_id, type, start_at, source_url) do nothing;

-- Sources YouTube (étape 5)
-- Les handles @xxx sont à vérifier / corriger si besoin
insert into sources (name, url, type, group_id)
select 'aespa YouTube', 'https://www.youtube.com/@aespa_official', 'youtube_api', id
from groups where slug = 'aespa'
on conflict (url) do nothing;

insert into sources (name, url, type, group_id)
select 'ILLIT YouTube', 'https://www.youtube.com/@ILLIT_official', 'youtube_api', id
from groups where slug = 'illit'
on conflict (url) do nothing;

insert into sources (name, url, type, group_id)
select 'BABYMONSTER YouTube', 'https://www.youtube.com/@BABYMONSTER_OFFICIAL', 'youtube_api', id
from groups where slug = 'babymonster'
on conflict (url) do nothing;

insert into sources (name, url, type, group_id)
select '(G)I-DLE YouTube', 'https://www.youtube.com/@GIDLE', 'youtube_api', id
from groups where slug = 'gidle'
on conflict (url) do nothing;
