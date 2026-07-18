-- 0061 — Aliases de matching par groupe (round 2026-07-18).
-- Les titres des chaînes broadcasters facturent souvent l'artiste en HANGUL
-- seul (« Forever July - 선미 ») ou via le membre soliste sans mention du
-- groupe (« Ice Cream - 연준 » pour le slot TXT) → 3 stages du Music Bank 1295
-- (MONSTA X, Sunmi, TXT) jamais liés par rankStageCandidates. La colonne porte
-- les variantes vérifiées (hangul officiel, ancien nom, membre facturé) ;
-- consommée par matchesGroup (stage-links) et matchGroup (lineups).
-- RLS : `groups` est déjà public-read — la colonne hérite des policies
-- existantes, aucune policy nouvelle requise.
alter table groups
  add column if not exists name_aliases text[] not null default '{}';

comment on column groups.name_aliases is
  'Variantes de nom pour le matching scraper (hangul, rebrand, membre facturé en lineup). Seedées par scripts/seed-group-aliases.ts.';
