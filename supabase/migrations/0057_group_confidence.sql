-- 0057 — Tiers de confiance INTERNES (Phase 3 Lot 2, audit §4.1).
-- « Catalogue large, niveau de garantie gradué » :
--   verified  : identité + sources confirmées (≥1 chaîne YouTube posée)
--               → publié, notifiable (comportement actuel).
--   monitored : artiste légitime, couverture potentiellement partielle
--               → publié, ne notifie que les données à forte confiance
--               (status confirmed OU source youtube_api).
--   candidate : détection automatique encore ambiguë
--               → noindex + hors sitemap, JAMAIS de notification.
-- Tiers internes (décision Rudy 2026-07-17) : visibles dans /admin seulement.
--
-- Backfill AJUSTÉ après pré-check prod (2026-07-17) : les 5 groupes sans
-- chaîne (Cherish, DK X Seungkwan, NCT JNJM, SUCTION, V8) ont tous roster
-- complet + agence connue + debut passé = des « Surveillés » légitimes, pas
-- des ambigus → le tier candidate démarre VIDE et se peuplera par les futures
-- auto-créations sans chaîne vérifiée (debuts/ingest.ts). Distribution
-- attendue : 166 verified / 5 monitored / 0 candidate.

create type public.group_confidence as enum ('verified', 'monitored', 'candidate');

alter table public.groups
  add column confidence public.group_confidence not null default 'monitored';

update public.groups g
set confidence = 'verified'
where exists (
  select 1 from public.sources s
  where s.group_id = g.id and s.type = 'youtube_api'
);
