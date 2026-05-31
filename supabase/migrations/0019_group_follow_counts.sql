-- ============================================================
-- KStage — compte de follows par groupe (tri Popularité, §3.4)
--   user_follows est en RLS (un user ne voit que ses propres
--   follows) → impossible d'agréger côté client. RPC SECURITY
--   DEFINER qui ne renvoie QUE des agrégats (group_id, count),
--   aucune identité user → exposable publiquement.
-- ============================================================

create or replace function public.group_follow_counts()
returns table (group_id uuid, follows bigint)
language sql
security definer
stable
set search_path = public
as $$
  select group_id, count(*)::bigint as follows
  from user_follows
  group by group_id
$$;

grant execute on function public.group_follow_counts() to anon, authenticated;
