-- R8-B3 (2026-07-14) : réseaux sociaux par membre (Instagram surtout, Weverse
-- manuel plus tard). Même forme que groups.links (jsonb {platform: url}).
-- Pas de RLS à ajouter : members = SELECT public, écritures service_role.
alter table public.members add column if not exists links jsonb;
comment on column public.members.links is
  'Réseaux du membre {instagram, weverse, twitter…}, comme groups.links. Instagram auto (fandom), reste manuel.';
