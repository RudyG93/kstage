-- Zone commentaires : les quatre trous que le balayage du 2026-08-23 a trouvés
-- en base, plus le nettoyage des votes que 0067 avait laissés derrière lui.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) L'historique d'édition était FORGEABLE.
--
-- `comment_edit_history: insert own` ne vérifiait que `auth.uid() = user_id` :
-- que l'insérant s'attribue la ligne, jamais que `comment_id` désigne un
-- commentaire qui lui appartient. La table est en lecture publique et n'a
-- aucune policy UPDATE/DELETE. N'importe quel compte pouvait donc poser une
-- fausse « version précédente » sur le commentaire d'un autre — visible de
-- tous, et que la victime ne pouvait pas retirer.
--
-- On retire le droit d'écrire à l'utilisateur : l'archive devient l'affaire du
-- serveur, écrite par un trigger. Elle cesse au passage d'être « best-effort
-- applicatif » (un insert séparé, hors transaction, dont l'échec était assumé
-- dans le code) pour devenir un invariant de la base.
revoke insert, update, delete on public.comment_edit_history from anon, authenticated;
drop policy if exists "comment_edit_history: insert own" on public.comment_edit_history;

alter table public.comment_edit_history
  drop constraint if exists comment_edit_history_body_len;
alter table public.comment_edit_history
  add constraint comment_edit_history_body_len
  check (char_length(previous_body) <= 5000);

create or replace function public.comments_archive_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- L'auteur archivé est celui du COMMENTAIRE, pas l'appelant : c'est bien sa
  -- version qu'on conserve, et un admin qui modère n'usurpe pas sa signature.
  if new.body is distinct from old.body then
    insert into public.comment_edit_history (comment_id, user_id, previous_body)
    values (old.id, old.user_id, old.body);
  end if;
  return new;
end;
$$;

drop trigger if exists comments_archive_edit on public.comments;
create trigger comments_archive_edit
  after update of body on public.comments
  for each row execute function public.comments_archive_edit();

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Profondeur non bornée et parent d'une AUTRE cible.
--
-- `parentId` n'était validé que comme UUID : rien n'empêchait de répondre à
-- un commentaire d'un autre MV, ni d'enchaîner les réponses indéfiniment.
-- L'arbre est construit et trié par des fonctions récursives à chaque rendu :
-- une chaîne linéaire assez longue fait exploser la pile côté serveur, et la
-- page devient définitivement inaccessible (il n'existe aucune policy DELETE
-- sur `comments`).
--
-- La colonne `depth` rend le contrôle O(1) au lieu de remonter la chaîne à
-- chaque insert.
alter table public.comments add column if not exists depth smallint not null default 0;

create or replace function public.comments_set_depth()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p record;
begin
  if new.parent_id is null then
    new.depth := 0;
    return new;
  end if;

  select c.depth, c.event_id, c.episode_id into p
  from public.comments c where c.id = new.parent_id;

  if not found then
    raise exception 'parent comment does not exist' using errcode = 'foreign_key_violation';
  end if;
  -- Un fil appartient à UNE cible : répondre à un commentaire d'un autre MV
  -- ou d'un autre épisode n'a aucun sens, et rend l'arbre incohérent.
  if p.event_id is distinct from new.event_id or p.episode_id is distinct from new.episode_id then
    raise exception 'parent comment belongs to another target' using errcode = 'check_violation';
  end if;

  new.depth := p.depth + 1;
  if new.depth > 8 then
    raise exception 'reply is nested too deep' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_set_depth on public.comments;
create trigger comments_set_depth
  before insert on public.comments
  for each row execute function public.comments_set_depth();

-- Backfill de la profondeur existante (6 lignes, profondeur max 2).
with recursive arbre as (
  select id, 0 as d from public.comments where parent_id is null
  union all
  select c.id, a.d + 1 from public.comments c join arbre a on c.parent_id = a.id
)
update public.comments c set depth = a.d from arbre a where a.id = c.id and c.depth is distinct from a.d;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) L'historique de vote de n'importe qui était énumérable.
--
-- `comment_votes` était en SELECT `using (true)` — clé anon dans le bundle,
-- donc un `GET /rest/v1/comment_votes?user_id=eq.<uuid>` rendait tout ce qu'un
-- utilisateur a jamais voté. Le produit n'a besoin que de DEUX choses : le
-- score agrégé (public) et le vote du VIEWER (privé). On sépare.
drop policy if exists "comment_votes: readable by all" on public.comment_votes;
create policy "comment_votes: read own only"
  on public.comment_votes for select
  using ((select auth.uid()) = user_id);

create or replace function public.comment_scores(ids uuid[])
returns table (comment_id uuid, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.comment_id, sum(v.value)::integer
  from public.comment_votes v
  where v.comment_id = any(ids)
  group by v.comment_id
$$;

revoke all on function public.comment_scores(uuid[]) from public;
grant execute on function public.comment_scores(uuid[]) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 4) Les auto-votes que 0067 a interdits mais pas nettoyés.
--
-- 0067 a posé la policy ; les lignes antérieures sont restées et comptaient
-- toujours dans le score affiché (4 votes en base, 4 auto-votes).
delete from public.comment_votes v
using public.comments c
where c.id = v.comment_id and c.user_id = v.user_id;

-- Un vote sur un commentaire retiré n'a plus de surface pour être annulé.
delete from public.comment_votes v
using public.comments c
where c.id = v.comment_id and c.deleted_at is not null;
