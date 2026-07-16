-- 0055 — Unicité des sources GLOBALES (Phase 3 Lot 1, audit §9.2).
-- La migration 0033 a remplacé unique(url) par unique(url, group_id) : les
-- sources à group_id NULL (kpopofficial, wikipedia, community, music_shows)
-- ne sont plus dédupliquées — en SQL, NULL n'est jamais égal à NULL, l'index
-- composite laisse passer les doublons. Index unique PARTIEL : une seule row
-- par URL globale. Pré-check prod exécuté avant apply : 0 doublon existant.
--
-- C'est aussi la cible d'`ON CONFLICT (url) WHERE group_id IS NULL` utilisée
-- par 0056 (rows structurelles) et les futures migrations de sources globales.

create unique index if not exists sources_url_global_unique
  on public.sources (url)
  where group_id is null;
