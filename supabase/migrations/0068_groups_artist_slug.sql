-- `groups.artist_slug` — le slug de la page vers laquelle un groupe SOLO
-- redirige déjà.
--
-- `/groups/<slug>` répond 307 vers `/artists/<slug du membre canonique>` quand
-- `is_solo`. Tous les liens internes construits par `eventHref` pointaient donc
-- sur une redirection : un aller-retour de plus au clic, et un lien interne qui
-- ne désigne pas la page finale pour un crawler. Le slug du membre n'était pas
-- déductible du slug du groupe — 9 des 38 solistes diffèrent (`chungha` →
-- `chungha-chung-ha`, `ph1` → `ph1-ph-1`…).
--
-- Dénormalisé plutôt que joint : `eventHref` est une fonction PURE appelée
-- depuis une dizaine de composants, et l'embed PostgREST équivalent
-- (`groups(members(slug))`) transporterait le roster entier pour les groupes
-- non solo. Une colonne, tenue à jour par trigger.

alter table public.groups add column if not exists artist_slug text;

comment on column public.groups.artist_slug is
  'Slug du membre canonique quand is_solo (NULL sinon). Cible réelle de /groups/<slug>, qui redirige. Maintenu par le trigger sync_group_artist_slug.';

create or replace function public.compute_group_artist_slug(p_group_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select m.slug
  from public.members m
  where m.group_id = p_group_id
    and m.canonical_id is null
    and m.slug is not null
  -- Un groupe solo n'a qu'un membre canonique ; l'ordre ne sert qu'à rendre le
  -- résultat déterministe si la donnée dérive.
  order by m.created_at nulls last, m.id
  limit 1
$$;

create or replace function public.sync_group_artist_slug()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  gid uuid;
begin
  gid := coalesce(new.group_id, old.group_id);
  update public.groups g
  set artist_slug = case when g.is_solo then public.compute_group_artist_slug(g.id) end
  where g.id = gid;
  -- Un membre qui CHANGE de groupe laisse son ancien groupe à recalculer.
  if tg_op = 'UPDATE' and new.group_id is distinct from old.group_id then
    update public.groups g
    set artist_slug = case when g.is_solo then public.compute_group_artist_slug(g.id) end
    where g.id = old.group_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists members_sync_group_artist_slug on public.members;
create trigger members_sync_group_artist_slug
  after insert or update of slug, canonical_id, group_id or delete
  on public.members
  for each row execute function public.sync_group_artist_slug();

-- `is_solo` peut basculer (un soliste rejoint un groupe, un groupe se réduit).
create or replace function public.sync_own_artist_slug()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.artist_slug := case when new.is_solo then public.compute_group_artist_slug(new.id) end;
  return new;
end;
$$;

drop trigger if exists groups_sync_artist_slug on public.groups;
create trigger groups_sync_artist_slug
  before update of is_solo on public.groups
  for each row execute function public.sync_own_artist_slug();

-- Backfill.
update public.groups g
set artist_slug = case when g.is_solo then public.compute_group_artist_slug(g.id) end;
