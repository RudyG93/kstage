-- ============================================================
-- KStage — auto-création de la row `profiles` au signup
--   - Trigger AFTER INSERT sur auth.users → handle_new_user()
--   - SECURITY DEFINER pour bypasser la policy RLS « insert own »
--     (auth.uid() = id) qui n'est pas applicable en contexte
--     trigger. search_path verrouillé = anti-hijack de schéma.
--   - Backfill : les users existants sans row profiles (cf. bug
--     « unknown » dans les commentaires de /mv/[slug] livré en
--     phase 4.C avant ce fix).
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill des users existants sans profile.
insert into public.profiles (id)
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
