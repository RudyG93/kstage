-- Rate-limit atomique générique (2026-07-04).
-- Remplace les checks « SELECT count puis INSERT » non atomiques des server
-- actions (comments, suggestions, feedback) — contournables en burst parallèle —
-- et donne un cap à savePushSubscription qui n'en avait aucun.
--
-- Mécanisme : table de hits + fonction SECURITY DEFINER qui sérialise chaque
-- couple (user, action) par advisory lock transactionnel → count + insert
-- deviennent indissociables, un burst concurrent ne dépasse jamais le cap.

create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_lookup_idx
  on public.rate_limit_hits (user_id, action, created_at desc);

-- RLS activée SANS policy : deny-all via l'API PostgREST. Seule la fonction
-- SECURITY DEFINER ci-dessous lit/écrit cette table (intentionnel).
alter table public.rate_limit_hits enable row level security;

-- Consomme un slot pour (auth.uid(), p_action) dans une fenêtre glissante.
-- Retourne true si l'appel est autorisé (hit enregistré), false si cap atteint.
-- Le hit est consommé même si l'insert domaine échoue ensuite côté action :
-- acceptable pour de l'anti-spam (pas de la facturation).
create or replace function public.consume_rate_limit(
  p_action text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count int;
begin
  if v_user is null then
    return false;
  end if;

  -- Sérialise les appels concurrents du même (user, action) jusqu'au commit.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_action, 0));

  -- Ménage opportuniste : purge les hits expirés de ce couple — la table reste minuscule.
  delete from public.rate_limit_hits
  where user_id = v_user
    and action = p_action
    and created_at <= now() - make_interval(secs => p_window_seconds);

  select count(*)
    into v_count
  from public.rate_limit_hits
  where user_id = v_user
    and action = p_action;

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (user_id, action) values (v_user, p_action);
  return true;
end;
$$;

revoke execute on function public.consume_rate_limit(text, int, int) from public, anon;
grant execute on function public.consume_rate_limit(text, int, int) to authenticated;
