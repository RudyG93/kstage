-- 0040 — Cause racine des doublons music_show (SCRAPING.md §3.14).
-- Autorisation explicite Rudy 2026-07-11.
--
-- L'enrichissement stage-links écrivait la vidéo YouTube du passage dans
-- events.source_url, qui fait partie de la clé d'idempotence du scraper
-- (contrainte unique events_group_id_type_start_at_source_url_key) : chaque
-- re-scrape carrd réinsérait alors une row doublon (14 paires en prod au
-- 2026-07-05, 16 rows au 07-10). Fix : colonne dédiée `stage_url` pour
-- l'enrichissement ; source_url reste immuable.
--
-- ⚠️ Ordre critique : la purge (2) DOIT précéder la restauration (3), sinon
-- restaurer l'URL carrd sur la row enrichie viole la contrainte unique tant
-- que la row doublon carrd existe encore (constaté au 1er apply).

alter table public.events
  add column if not exists stage_url text;

comment on column public.events.stage_url is
  'Vidéo YouTube du passage (enrichissement stage-links, music_show). '
  'Ne jamais réutiliser source_url pour ça : il fait partie de la clé '
  'd''idempotence du scraper.';

-- 2) Purger les doublons existants : pour chaque (group_id, title, start_at)
--    music_show en double, garder la row la plus ancienne (celle qui porte
--    l'enrichissement). Vérifié le 2026-07-11 : 0 référence FK (ratings,
--    comments, likes, suggestions, winners, notifications) sur ces rows.
delete from public.events e
using public.events k
where e.type = 'music_show'
  and k.type = 'music_show'
  and k.group_id = e.group_id
  and k.start_at = e.start_at
  and k.title    = e.title
  and (k.created_at < e.created_at
       or (k.created_at = e.created_at and k.id < e.id));

-- 3) Migrer les rows enrichies par l'ancien mécanisme : le stage YouTube part
--    dans stage_url, source_url est restauré à l'URL carrd (clé stable).
update public.events
set stage_url  = source_url,
    source_url = 'https://liveshowupdatess.carrd.co/'
where type = 'music_show'
  and (source_url ilike '%youtube.com%' or source_url ilike '%youtu.be%');

-- 4) Garantie complémentaire : un seul music_show par (groupe, instant), même
--    si source_url divergeait à nouveau. L'insert du scraper loggue et skippe
--    proprement en cas de violation.
create unique index if not exists events_music_show_group_start_key
  on public.events (group_id, start_at)
  where type = 'music_show';

-- 5) Doublon same-source kpopofficial (SCRAPING.md §3.15) : la source poste
--    une entrée placeholder puis l'entrée album finalisée sous 2 URLs. Purge
--    des 2 cas connus (0 référence FK, vérifié 2026-07-11) ; le code de dédup
--    ±3 j couvre désormais la même source pour la suite.
delete from public.events
where type = 'release'
  and source_url in (
    'https://kpopofficial.com/album/fromis-9-comeback/',   -- placeholder, « Glow ME » conservé
    'https://kpopofficial.com/album/triples-love-pop-pt-1/' -- variante, « ASSEMBLE26 … » conservé
  );
