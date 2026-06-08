-- Stats agrégées d'un profil public (§ profil-vitrine, audit rétention) :
-- nb de groupes suivis, MV notés, MV likés, commentaires.
--
-- SECURITY DEFINER nécessaire pour `followed` : `user_follows` est en RLS
-- « own rows », donc le nombre de follows d'un AUTRE utilisateur n'est pas
-- lisible côté client. On n'expose que des COUNTS (aucune donnée d'identité),
-- même esprit que group_follow_counts. Les 3 autres tables sont déjà SELECT
-- public, mais on les agrège ici pour un seul aller-retour.

create or replace function public.profile_stats(p_user_id uuid)
returns table(followed int, rated int, liked int, comments int)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*)::int from user_follows  where user_id = p_user_id),
    (select count(*)::int from event_ratings where user_id = p_user_id),
    (select count(*)::int from mv_like        where user_id = p_user_id),
    (select count(*)::int from comments       where user_id = p_user_id and deleted_at is null);
$$;

grant execute on function public.profile_stats(uuid) to anon, authenticated;
