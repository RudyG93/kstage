-- ============================================================
-- 0011_members_profile.sql
-- Étend la table `members` pour permettre des pages profil par membre :
--   - `slug`         : composite `{group_slug}-{slugified(stage_name)}`, unique global,
--                      nullable au début (backfill applique), partial index actif.
--   - `photo_url`    : URL de la photo profil (Supabase Storage ou external). Placeholder
--                      gradient utilisé côté UI si null.
--   - `status`       : enum lifecycle `active | former | pre_debut`. Permet de distinguer
--                      Soojin (former, i-dle) ou Youngseo (pre_debut, ILLIT) sans les
--                      retirer du roster.
--   - `former_reason`: texte court factuel, libre. Optionnel même quand status='former'.
-- Pas de CHECK constraint : laissé volontairement souple pour permettre des cas où
-- le départ est public mais sans raison documentée.
-- RLS héritée de `0002_rls.sql` (`members readable by all`) — pas de policy à ajouter.
-- ============================================================

create type member_status as enum ('active', 'former', 'pre_debut');

alter table members
  add column slug text,
  add column photo_url text,
  add column status member_status not null default 'active',
  add column former_reason text;

-- Unique partial : les 827 rows existantes ont slug=null jusqu'au backfill ;
-- l'index ignore les null donc pas de violation initiale.
create unique index members_slug_uniq on members(slug) where slug is not null;
