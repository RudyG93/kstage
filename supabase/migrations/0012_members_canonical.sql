-- ============================================================
-- 0012_members_canonical.sql
-- Permet de représenter "une personne" plutôt qu'"une membership" :
-- chaque artiste a UNE row canonique (canonical_id IS NULL) qui porte
-- son identité actuelle. Les memberships passées (ex. ILLIT Youngseo
-- pre-debut, i-dle Soojin former) pointent vers la canonique via
-- canonical_id. La page /artists/[slug] redirect vers la canonique
-- si on arrive sur une row historique.
--
-- ON DELETE SET NULL : si jamais on supprime une canonique par accident,
-- les anciennes rows restent visibles individuellement (pas de cascade
-- destructive). Index partiel pour la query "tous les memberships de
-- l'artiste canonique X".
-- RLS héritée de 0002_rls.sql.
-- ============================================================

alter table members
  add column canonical_id uuid references members(id) on delete set null
    check (canonical_id is distinct from id);

create index members_canonical_id_idx on members(canonical_id) where canonical_id is not null;

-- Invariant applicatif (pas enforced DB) : on n'autorise PAS de chaîne 2-level
-- (A → B → C). Le seeder doit toujours pointer une historique vers une row
-- canonique stricte (canonical_id IS NULL).
