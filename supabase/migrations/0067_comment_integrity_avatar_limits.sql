-- Intégrité des commentaires + garde-fous du bucket avatars.
--
-- Trois trous relevés au balayage du 2026-08-23, tous du même genre : le code
-- suppose une règle, la base ne l'écrit nulle part.

-- 1) Auto-vote. Rien n'empêchait de mettre +1 sur son propre commentaire :
--    ni le code, ni la policy, ni une contrainte. Les 4 votes présents en base
--    sont d'ailleurs 4 auto-votes. Le score d'un commentaire est un signal
--    social : son auteur n'en est pas une source.
drop policy if exists "comment_votes: insert own" on public.comment_votes;
create policy "comment_votes: insert own, pas sur son propre commentaire"
  on public.comment_votes for insert
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.comments c
      where c.id = comment_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "comment_votes: update own" on public.comment_votes;
create policy "comment_votes: update own, pas sur son propre commentaire"
  on public.comment_votes for update
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.comments c
      where c.id = comment_id and c.user_id = (select auth.uid())
    )
  );

-- 2) Colonnes immuables d'un commentaire. « comments: update own » n'autorise
--    que ses propres lignes, mais n'immobilise AUCUNE colonne : un user
--    pouvait re-parenter son commentaire (parent_id) et faire basculer tout un
--    fil ailleurs, ou le déplacer vers un autre MV. Une policy RLS ne compare
--    pas OLD et NEW — il faut un trigger.
create or replace function public.comments_freeze_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.mv_id is distinct from old.mv_id
     or new.parent_id is distinct from old.parent_id
     or new.created_at is distinct from old.created_at then
    raise exception 'comment identity is immutable (user_id, mv_id, parent_id, created_at)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_freeze_identity on public.comments;
create trigger comments_freeze_identity
  before update on public.comments
  for each row execute function public.comments_freeze_identity();

-- 3) Bucket `avatars` : la policy autorisait ce que le code refuse (2 Mo,
--    PNG/JPEG/WebP). Un client qui parle directement au Storage n'était borné
--    par rien. On aligne la base sur updateAvatar().
update storage.buckets
set file_size_limit = 2 * 1024 * 1024,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'avatars';

-- 4) Le ménage de l'ancien avatar ne supprimait jamais rien : storage.remove()
--    résout d'abord l'objet par un SELECT, et 0035 avait retiré la policy
--    SELECT du bucket — le DELETE ne trouvait donc rien à supprimer (12 des 14
--    objets du bucket sont des orphelins, toujours servis publiquement).
--    Un SELECT limité à SON dossier ne révèle rien de plus : le bucket est
--    public, les objets sont déjà lisibles par leur URL.
drop policy if exists "avatars: select own folder" on storage.objects;
create policy "avatars: select own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
