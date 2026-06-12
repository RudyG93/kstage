-- P0.4 : cache du channel_id résolu + subscriber_count YouTube (critère de
-- popularité de remplacement, spotify_followers étant inalimentable — cf.
-- docs/BACKLOG.md P0.5). Rafraîchis à chaque run du scraper YouTube.
alter table public.sources
  add column channel_id text,
  add column subscriber_count bigint;
