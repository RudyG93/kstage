-- P1 sécurité (advisor public_bucket_allows_listing). Les buckets avatars/banners
-- sont PUBLICS : l'affichage passe par getPublicUrl (/storage/v1/object/public/…),
-- indépendant de la policy SELECT sur storage.objects. La policy "readable by all"
-- (SELECT large sur tout le bucket) n'autorise donc QUE l'énumération/listing des
-- fichiers via l'API authentifiée — non désiré. On la retire : URLs publiques et
-- uploads (avatars: insert own folder ; banners: service-role admin) inchangés.
-- Vérifié 2026-06-15 : l'app n'utilise que getPublicUrl (profiles/actions.ts,
-- banner-actions.ts), aucun .list(), buckets vides.
drop policy if exists "avatars: readable by all" on storage.objects;
drop policy if exists "banners: readable by all" on storage.objects;
