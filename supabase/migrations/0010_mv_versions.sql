-- ============================================================
-- KStage — versions de MV (PR-B feat/mv-versions-and-filtering)
--   - mv_kind : enum classifiant un MV (main / performance / member / other_version)
--   - member_id : FK members nullable (renseigné quand mv_kind='member')
--   - Filtrage par surface dans queries.ts (cf. docs/SCRAPING.md §8)
-- ============================================================

-- mv_kind : enum classifie chaque MV pour filtrage par surface :
--   'main'           = clip principal, visible partout
--   'performance'    = Performance/Dance/Choreography ver., visible /groups uniquement
--   'member'         = version centrée sur un membre (Moka ver.), visible /artists/[slug]
--   'other_version'  = Remake/English/sub-unit/etc., invisible globalement
create type mv_kind as enum ('main', 'performance', 'member', 'other_version');

-- mv_kind nullable : explicite que la notion n'a de sens que pour type='mv'.
-- Les rows non-MV (release/concert/music_show/anniversary/other) restent NULL
-- — évite qu'un futur dev pense que 'main' s'applique à un concert.
-- member_id : FK members. ON DELETE SET NULL si un membre est retiré du roster
-- (cas rare). L'incohérence transitoire mv_kind='member' + member_id=NULL est
-- bloquée à l'INSERT par le CHECK ci-dessous.
alter table events
  add column mv_kind mv_kind,
  add column member_id uuid references members(id) on delete set null;

-- Invariant : member_id ne peut exister que si mv_kind='member'. Empêche
-- d'insérer un member_id avec un mv_kind incohérent (Performance + member_id
-- = bug). Le cas (member_id NULL, mv_kind='member') reste autorisé pour gérer
-- les rows orphelines après deletion de membre (cf. SET NULL).
alter table events add constraint events_member_id_implies_member_kind
  check (member_id is null or mv_kind = 'member');

-- Backfill : tous les events type='mv' existants partent en 'main' par défaut.
-- Le script scripts/backfill-mv-versions.ts redétecte ensuite les ~9 versions
-- réelles (5 perf + 2 member + 3 other_version) via mv-version.ts.
update events set mv_kind = 'main' where type = 'mv';

-- Index partiel : filtres mv_kind sont toujours scoped à type='mv'. Évite
-- d'indexer les ~110 rows non-MV qui ont mv_kind=NULL.
create index events_mv_kind_idx on events (mv_kind) where type = 'mv';

-- Index pour /artists/[slug] (PR-C) : SELECT WHERE member_id = X.
-- Partiel pour ignorer le ~99% des rows où member_id is null.
create index events_member_id_idx on events (member_id) where member_id is not null;
