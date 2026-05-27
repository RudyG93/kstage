-- ============================================================
-- KStage — profils utilisateurs (post-MVP, phase 1)
--   - 1 ligne par user (id = auth.users.id), username + avatar.
--   - Lecture publique (les usernames/avatars seront affichés
--     sur les commentaires en phase 4), écriture sur ses propres
--     lignes uniquement.
--   - Bucket Storage `avatars` public, écriture limitée au
--     dossier <user_id>/ de l'utilisateur.
-- ============================================================

create extension if not exists citext;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  -- garde-fou DB ; la validation de format vit côté action
  constraint profiles_username_len check (
    username is null or char_length(username) between 3 and 20
  )
);

alter table profiles enable row level security;

create policy "profiles: readable by all"
  on profiles for select using (true);
create policy "profiles: insert own"
  on profiles for insert with check (auth.uid() = id);
create policy "profiles: update own"
  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- ------------------------------------------------------------
-- Storage : bucket avatars (public en lecture)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars: readable by all"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: insert own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: update own folder"
  on storage.objects for update
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: delete own folder"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
