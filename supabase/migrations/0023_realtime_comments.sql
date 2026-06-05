-- Active Supabase Realtime sur la table `comments` pour le bloc "Recent
-- discussions" live de la home (§7.2). La RLS SELECT est déjà publique
-- ("comments: readable by all"), donc les abonnements anon reçoivent les INSERT.
-- Idempotent : sûr à rejouer.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end $$;
