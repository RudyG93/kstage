-- ============================================================
-- KStage — bandeau recadré manuellement par admin (phase 3)
--   banner_url : override manuel (admin) qui prime sur l'image auto.
--   Bucket `banners` public en lecture ; écriture via service_role (action admin).
-- ============================================================

alter table groups add column if not exists banner_url text;

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

create policy "banners: readable by all"
  on storage.objects for select
  using (bucket_id = 'banners');
