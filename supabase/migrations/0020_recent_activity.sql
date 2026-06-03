-- Recent Activity feed (§3.1-D) : flux unifié des dernières interactions pour la
-- sidebar droite de la home. Agrège commentaires / notes / likes / inscriptions
-- en une seule requête triée. Toutes les sources sont déjà public-readable via
-- RLS → `security invoker` suffit (pas d'escalade de privilèges). On n'expose que
-- des données publiques (username, avatar, titre d'event).

create or replace function public.recent_activity(p_limit int default 12)
returns table (
  kind text,
  actor_username text,
  actor_avatar text,
  score int,
  event_id uuid,
  event_slug text,
  event_type text,
  event_title text,
  group_name text,
  group_slug text,
  ts timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from (
    -- Commentaires
    select
      'comment'::text       as kind,
      p.username::text       as actor_username,
      p.avatar_url           as actor_avatar,
      null::int              as score,
      e.id                   as event_id,
      e.slug                 as event_slug,
      e.type::text           as event_type,
      e.title                as event_title,
      g.name                 as group_name,
      g.slug                 as group_slug,
      c.created_at           as ts
    from public.comments c
    join public.profiles p on p.id = c.user_id
    join public.events   e on e.id = c.event_id
    join public.groups   g on g.id = e.group_id
    where c.deleted_at is null and p.username is not null

    union all

    -- Notes (1-10)
    select
      'rating'::text, p.username::text, p.avatar_url, r.score::int,
      e.id, e.slug, e.type::text, e.title, g.name, g.slug, r.created_at
    from public.event_ratings r
    join public.profiles p on p.id = r.user_id
    join public.events   e on e.id = r.event_id
    join public.groups   g on g.id = e.group_id
    where p.username is not null

    union all

    -- Likes MV
    select
      'like'::text, p.username::text, p.avatar_url, null::int,
      e.id, e.slug, e.type::text, e.title, g.name, g.slug, l.created_at
    from public.mv_like l
    join public.profiles p on p.id = l.user_id
    join public.events   e on e.id = l.event_id
    join public.groups   g on g.id = e.group_id
    where p.username is not null

    union all

    -- Inscriptions (nouveaux profils avec username défini)
    select
      'signup'::text, p.username::text, p.avatar_url, null::int,
      null::uuid, null::text, null::text, null::text, null::text, null::text,
      p.created_at
    from public.profiles p
    where p.username is not null
  ) acts
  order by acts.ts desc
  limit p_limit;
$$;

grant execute on function public.recent_activity(int) to anon, authenticated;
