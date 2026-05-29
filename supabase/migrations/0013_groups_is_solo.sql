-- ============================================================
-- 0013_groups_is_solo.sql
-- Sépare visuellement les "groupes" k-pop des "solistes" sur /groups.
-- Le modèle existant représente un soliste comme un groupe à 1 membre
-- avec position='Soloist' (cf. scripts/roster/seed-soloists.ts +
-- scripts/seed-canonical-artists.ts). Cette migration matérialise ce
-- statut sur le `groups` row pour éviter un join à chaque query.
--
-- RLS héritée de 0002_rls.sql (lecture publique).
-- ============================================================

alter table groups
  add column is_solo boolean not null default false;

-- Backfill : un groupe est solo s'il a exactement 1 membre, position='Soloist'.
-- Guard count=1 défend contre une future row Soloist mal-labelée sur un vrai
-- groupe à 5+ membres (defensive depth, cf. DBA review 2026-05-29).
update groups g
set is_solo = true
where exists (
  select 1 from members m
  where m.group_id = g.id
    and m.position = 'Soloist'
)
and (select count(*) from members m where m.group_id = g.id) = 1;
