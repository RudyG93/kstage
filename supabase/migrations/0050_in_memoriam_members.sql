-- R9 (2026-07-14) : In memoriam — insertion des membres décédés absents de la
-- base (Jonghyun/SHINee, Moonbin/ASTRO), statut 'deceased'. La photo est sourcée
-- ensuite par le pipeline fandom (refresh-images --stale). Idempotent.
-- Jointure sur groups (rétro-fix 2026-07-17, job CI DB) : UUID de PROD — sur
-- base fraîche les groupes n'existent pas, l'insert direct violait la FK.
-- No-op propre sur base vierge, sémantique inchangée en prod.
insert into public.members (group_id, stage_name, real_name, birthday, status, slug)
select v.gid::uuid, v.stage, v.real, v.bday::date, 'deceased'::member_status, v.slug
from (values
  ('c3314df3-742e-4d4e-be3b-df13d93f85a7', 'Jonghyun', 'Kim Jonghyun', '1990-04-08', 'shinee-jonghyun'),
  ('68114409-e5f0-4905-bd38-e68ccc794dd3', 'Moonbin', 'Moon Bin', '1998-01-26', 'astro-moonbin')
) as v(gid, stage, real, bday, slug)
join public.groups g on g.id = v.gid::uuid
on conflict do nothing;
