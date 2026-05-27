-- ============================================================
-- KStage — image paysage par groupe (phase 3, bandeaux d'event)
--   image_url reste le carré (Deezer) pour avatars/petites cartes ;
--   image_landscape = backdrop paysage (TheAudioDB fanart) pour les bandeaux.
-- ============================================================

alter table groups add column if not exists image_landscape text;
