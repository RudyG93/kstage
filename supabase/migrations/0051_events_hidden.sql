-- R9 (2026-07-14) : flag « hidden » pour masquer un faux event (mis-scrape) sans
-- le supprimer — « faux event » ≠ « cancelled » (statut réel d'un event annulé).
-- Filtré dans les requêtes d'affichage/recherche. Écrit par l'éditeur admin.
alter table public.events add column if not exists hidden boolean not null default false;
comment on column public.events.hidden is
  'Masqué de l''affichage par un admin (faux event mis-scrapé). Filtré dans les queries display/search. Différent de status=cancelled (event réel annulé).';
