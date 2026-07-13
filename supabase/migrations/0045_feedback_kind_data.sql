-- R4-E (2026-07-13) : fusion Contribute → widget Feedback.
-- 3e catégorie 'data' (« un groupe/event/MV manque ou est faux ») — le
-- formulaire structuré de suggestions (3 onglets) est retiré de l'UI au
-- profit du texte libre ; les tables event_suggestions/artist_suggestions et
-- /admin/suggestions restent en place pour drainer l'historique.

alter table public.feedback drop constraint feedback_kind_check;
alter table public.feedback add constraint feedback_kind_check
  check (kind = any (array['bug'::text, 'idea'::text, 'data'::text]));
