-- ============================================================
-- KStage — vainqueur de l'épisode de music show.
--   Lu sur la MÊME page Wikipedia que la numérotation
--   (« List of {show} Chart winners (YYYY) ») : la ligne qui
--   porte (épisode, date) porte aussi l'artiste, le titre et
--   le rang de victoire. Zéro source nouvelle.
--   Le « Nth win » est la monnaie du fandom et n'apparaissait
--   nulle part chez nous alors qu'il transitait déjà dans le
--   parseur, jeté à la ligne suivante.
--   Additif : tout est nullable, aucune colonne existante
--   n'est touchée.
-- ============================================================

alter table public.show_episodes
  add column if not exists winner_group_id uuid references public.groups(id) on delete set null,
  add column if not exists winner_name text,
  add column if not exists winner_song text,
  add column if not exists winner_nth integer;

create index if not exists show_episodes_winner_group_idx
  on public.show_episodes (winner_group_id)
  where winner_group_id is not null;
