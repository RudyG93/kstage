-- Préemptions music-show (결방) — 2026-08-19.
-- Le board SBS publie des avis officiels « 결방 공지 » (ex. Inkigayo déprogrammé
-- les 2 et 9 août 2026) : sans cette table, le monitor alertait « J-1 sans
-- lineup » sur un épisode qui n'existe pas, et le calendrier affichait un slot
-- synthétique fantôme « Lineup TBA ». Alimentée par le cron scrape-music-shows
-- (parseBoardPreemptions), consommée par generateShowSlots et le check J-1.
-- show_title = displayName du descriptor (« Inkigayo », « The Show »).

create table public.show_preemptions (
  show_title text not null,
  kst_day date not null,
  source_url text,
  created_at timestamptz not null default now(),
  primary key (show_title, kst_day)
);

-- Donnée publique banale (« pas d'émission ce jour ») : SELECT ouvert — les
-- pages calendrier/home la lisent avec le client cookies. Écritures = service
-- role uniquement (aucune policy insert/update/delete, comme les tables de
-- contenu scrape).
alter table public.show_preemptions enable row level security;

create policy "show_preemptions_read_all"
  on public.show_preemptions for select
  using (true);
