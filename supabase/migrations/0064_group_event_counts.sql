-- ============================================================
-- KStage — compte d'events visibles par groupe (onboarding).
--   `getGroupEventCounts` rapatriait TOUTES les lignes `events`
--   pour les compter en TS. 4165 events visibles contre un
--   plafond PostgREST à 1000 : la Map était construite sur un
--   quart arbitraire, et 102 des 260 groupes ressortaient à 0 —
--   donc classés « sans contenu » par le tri de l'onboarding.
--   Postgres compte, on ne transporte que 260 lignes.
--   SECURITY INVOKER : `events` est en lecture publique, pas
--   besoin d'élever les droits pour un agrégat.
-- ============================================================

create or replace function public.group_event_counts()
returns table (group_id uuid, events bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select e.group_id, count(*)::bigint as events
  from events e
  where e.hidden = false and e.group_id is not null
  group by e.group_id
$$;

grant execute on function public.group_event_counts() to anon, authenticated;
