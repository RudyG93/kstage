-- ============================================================
-- KStage — community layer (post-MVP, phase 4)
--   - events.slug : URL canonique des articles (/mv/[slug]).
--   - event_ratings : note /10 par user × event (unique).
--   - comments : arbre récursif par parent_id, soft-delete via deleted_at.
--   - comment_votes : +1 / -1 par user × comment (toggle/change).
--   - RLS : lecture publique partout ; écriture own.
-- ============================================================

-- ------------------------------------------------------------
-- events.slug — URL canonique pour les pages article
-- ------------------------------------------------------------
-- La contrainte UNIQUE crée déjà un index B-tree → pas besoin d'index manuel
-- supplémentaire. Note pour plus tard : sur une table volumineuse, préférer
-- `CREATE UNIQUE INDEX CONCURRENTLY` puis `ADD CONSTRAINT ... USING INDEX`
-- pour éviter un lock ACCESS EXCLUSIVE. Sur ~30 rows ici c'est instant.
alter table events add column slug text unique;

-- ------------------------------------------------------------
-- event_ratings : note /10 par user × event
-- ------------------------------------------------------------
create table event_ratings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index on event_ratings (event_id);
create index on event_ratings (user_id);

alter table event_ratings enable row level security;

create policy "event_ratings: readable by all"
  on event_ratings for select using (true);
create policy "event_ratings: insert own"
  on event_ratings for insert with check (auth.uid() = user_id);
create policy "event_ratings: update own"
  on event_ratings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "event_ratings: delete own"
  on event_ratings for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- comments : arbre récursif Reddit-style, soft-delete pour préserver les fils
-- ------------------------------------------------------------
create table comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- ON DELETE SET NULL : si un parent est DELETÉ physiquement (admin via psql),
  -- ses enfants survivent comme racines. Le soft-delete (deleted_at) ne déclenche
  -- pas le SET NULL — l'arbre reste intact en cas d'usage normal.
  parent_id uuid references comments(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint comments_body_len check (char_length(body) between 1 and 5000)
);
-- Index composite pour le listing chronologique inverse (`where event_id = ?
-- order by created_at desc`) — le pattern dominant côté query de l'arbre.
create index on comments (event_id, created_at desc);
create index on comments (parent_id);
create index on comments (user_id);

alter table comments enable row level security;

create policy "comments: readable by all"
  on comments for select using (true);
create policy "comments: insert own"
  on comments for insert with check (auth.uid() = user_id);
-- Update own tant que pas soft-deleted (un commentaire effacé reste figé).
create policy "comments: update own"
  on comments for update
  using (auth.uid() = user_id and deleted_at is null)
  with check (auth.uid() = user_id);
-- Pas de delete physique : l'app fait UPDATE deleted_at via la policy update.
-- (on n'expose pas de delete pour préserver les fils orphelins)

-- ------------------------------------------------------------
-- comment_votes : +1 / -1 par user × comment (toggle/change)
-- ------------------------------------------------------------
create table comment_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_id uuid not null references comments(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);
create index on comment_votes (comment_id);

alter table comment_votes enable row level security;

create policy "comment_votes: readable by all"
  on comment_votes for select using (true);
create policy "comment_votes: insert own"
  on comment_votes for insert with check (auth.uid() = user_id);
create policy "comment_votes: update own"
  on comment_votes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "comment_votes: delete own"
  on comment_votes for delete using (auth.uid() = user_id);
