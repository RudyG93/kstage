-- P0.5 : une chaîne umbrella (HYBE LABELS, SMTOWN, JYP, YG…) héberge les MV de
-- plusieurs groupes. L'architecture du scraper = une ligne `sources` par
-- (chaîne, groupe), avec un filtre par nom de groupe sur le titre (§3.10) pour
-- attribuer chaque MV au bon groupe. La contrainte UNIQUE(url) interdisait de
-- réutiliser une même chaîne umbrella pour un 2e groupe.
--
-- On la remplace par UNIQUE(url, group_id) : même chaîne autorisée pour des
-- groupes distincts, mais toujours un seul (chaîne, groupe) — l'idempotence du
-- seed et du scrape est préservée. Aucun doublon de `url` n'existe avant ce
-- swap (l'ancienne contrainte l'interdisait), donc la migration est sûre.
alter table public.sources drop constraint sources_url_unique;
alter table public.sources add constraint sources_url_group_unique unique (url, group_id);
