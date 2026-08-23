-- CORRECTIF URGENT de 0067 : le trigger `comments_freeze_identity` référence
-- `new.mv_id`, une colonne qui n'existe pas — elle s'appelle `event_id`.
--
-- PL/pgSQL ne résout les champs d'un `record` qu'à l'EXÉCUTION : `create
-- function` a donc accepté la faute sans un mot, et la migration s'est
-- appliquée « avec succès ». Le premier UPDATE réel échoue en
-- `42703 / record "new" has no field "mv_id"` — et comme un trigger s'applique
-- aussi au service_role (qui ne contourne que la RLS), TOUTES les écritures
-- sur `comments` sont tombées :
--   - `editComment`   (src/lib/comments/actions.ts)
--   - `deleteComment` (le soft-delete utilisateur)
--   - `resolveReport` (la modération admin)
--
-- Leçon : une migration qui pose un trigger doit être EXERCÉE, pas seulement
-- appliquée. Le test de non-régression est en bas de ce fichier.

create or replace function public.comments_freeze_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- `episode_id` fait partie de l'identité au même titre qu'`event_id` : la
  -- contrainte `comments_one_target` (0060) impose exactement l'un des deux,
  -- et sans le geler un auteur pourrait déplacer son commentaire d'un épisode
  -- de music show vers un autre. Il manquait aussi dans 0067.
  if new.user_id is distinct from old.user_id
     or new.event_id is distinct from old.event_id
     or new.episode_id is distinct from old.episode_id
     or new.parent_id is distinct from old.parent_id
     or new.created_at is distinct from old.created_at then
    raise exception
      'comment identity is immutable (user_id, event_id, episode_id, parent_id, created_at)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Le trigger lui-même est déjà en place (0067) et pointe sur cette fonction ;
-- on le re-pose pour que la migration soit rejouable sur une base neuve.
drop trigger if exists comments_freeze_identity on public.comments;
create trigger comments_freeze_identity
  before update on public.comments
  for each row execute function public.comments_freeze_identity();

-- Exercice du trigger, dans la migration elle-même : un UPDATE bénin doit
-- passer, un re-parentage doit être refusé. Tout est annulé.
do $$
declare
  cible uuid;
  autre uuid;
begin
  select id into cible from public.comments where deleted_at is null limit 1;
  if cible is null then
    raise notice 'comments_freeze_identity : aucun commentaire, exercice sauté';
    return;
  end if;

  -- 1) une modification légitime du corps doit passer.
  update public.comments set body = body where id = cible;

  -- 2) un re-parentage doit lever.
  select id into autre from public.comments where id <> cible limit 1;
  if autre is not null then
    begin
      update public.comments set parent_id = autre where id = cible;
      raise exception 'comments_freeze_identity NE PROTEGE PAS parent_id';
    exception
      when check_violation then null; -- attendu
    end;
  end if;

  raise exception 'rollback_exercice';
exception
  when others then
    if sqlerrm <> 'rollback_exercice' then raise; end if;
end;
$$;
