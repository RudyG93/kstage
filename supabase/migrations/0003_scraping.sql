-- ============================================================
-- Étape 5 : liaison sources → groups pour le scraping
-- ============================================================

-- Lier chaque source scraping à un groupe
alter table sources add column group_id uuid references groups(id) on delete cascade;

-- Contrainte unique sur l'URL de source (évite les doublons au re-seed)
alter table sources add constraint sources_url_unique unique (url);
