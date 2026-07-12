-- R4-B (2026-07-13) : sources d'images fraîches et vérifiables.
--
-- 1. groups.banner_yt_url — bannière de la chaîne YouTube officielle du groupe
--    (brandingSettings.image.bannerExternalUrl + '=w2560', 2560x1440, mise à
--    jour par les labels à chaque ère). Colonne DÉDIÉE, distincte de banner_url
--    (crop manuel admin) : leçon feedback_idempotency_mutable_key — un champ
--    rafraîchi par cron ne partage jamais sa colonne avec une saisie manuelle.
--    Chaîne de rendu : banner_url ?? banner_yt_url ?? faceCrop(image_url).
--
-- 2. members.photo_source_key — URL source kpop.fandom de la photo courante
--    (contient le cache-buster cb= : clé de détection de changement pour ne
--    re-télécharger que les photos réellement mises à jour).
--    members.photo_checked_at — curseur de rotation du cron (batch quotidien).
--
-- Pas de RLS à ajouter : colonnes sur des tables aux policies existantes
-- (groups/members = SELECT public, écritures service_role uniquement).

alter table public.groups add column if not exists banner_yt_url text;
alter table public.members add column if not exists photo_source_key text;
alter table public.members add column if not exists photo_checked_at timestamptz;

comment on column public.groups.banner_yt_url is
  'Bannière chaîne YouTube officielle (=w2560), rafraîchie par le cron refresh-images. banner_url (manuel admin) garde priorité au rendu.';
comment on column public.members.photo_source_key is
  'URL source kpop.fandom de la photo self-hostée (clé de changement via cb=).';
comment on column public.members.photo_checked_at is
  'Dernier passage du cron photos (rotation par lots quotidiens).';
