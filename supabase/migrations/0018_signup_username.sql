-- ============================================================
-- KStage — username capturé à l'inscription (phase 2.A)
--   handle_new_user copie désormais le username depuis les
--   metadata du signup (options.data.username). La contrainte
--   `unique` citext sur profiles.username sert de garde-fou
--   anti-race : un username déjà pris → l'insert échoue →
--   la création de auth.users rollback → signUp renvoie une
--   erreur (rattrapée en message générique côté action).
--   Reste SECURITY DEFINER + search_path verrouillé comme 0015.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, nullif(new.raw_user_meta_data->>'username', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
