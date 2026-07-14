-- R9 (2026-07-14) : In memoriam — insertion des membres décédés absents de la
-- base (Jonghyun/SHINee, Moonbin/ASTRO), statut 'deceased'. La photo est sourcée
-- ensuite par le pipeline fandom (refresh-images --stale). Idempotent.
insert into public.members (group_id, stage_name, real_name, birthday, status, slug)
values
  ('c3314df3-742e-4d4e-be3b-df13d93f85a7', 'Jonghyun', 'Kim Jonghyun', '1990-04-08', 'deceased', 'shinee-jonghyun'),
  ('68114409-e5f0-4905-bd38-e68ccc794dd3', 'Moonbin', 'Moon Bin', '1998-01-26', 'deceased', 'astro-moonbin')
on conflict do nothing;
