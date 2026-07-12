-- R4-C bis (2026-07-13) : membres ACTUELS manquants (gaps de seed, pas des
-- erreurs de statut) — 13 fiches vérifiées Wikipedia EN + kprofiles le
-- 2026-07-13 (agent de vérification, sources croisées).
-- KARD : dissolution ANNONCÉE le 2026-07-06 (dernier album 28/07, tournée
-- d'adieu) — on ajoute quand même BM/J.Seph (encore actifs) ; disbanded_on
-- sera posé quand la dissolution sera effective (noté au BACKLOG).

insert into public.members (group_id, stage_name, real_name, birthday, position, status, slug)
select v.gid::uuid, v.stage, v.real, v.bday::date, v.pos, 'active'::member_status, v.slug
from (values
  ('f292480b-a070-4946-9ca2-79952640f8be', 'BM',            'Matthew Kim',           '1992-10-20', 'Main Dancer, Lead Rapper',        'kard-bm'),
  ('f292480b-a070-4946-9ca2-79952640f8be', 'J.Seph',        'Kim Taehyung',          '1992-06-21', 'Main Rapper, Lead Dancer',        'kard-j-seph'),
  ('2e120985-0364-46de-a36e-e62c6ddd5fb5', 'Dongsung',      'Seo Dongsung',          '1996-04-09', 'Bassist, Vocalist',               'nflying-dongsung'),
  ('932afbf4-dd4a-49e9-98b3-fa519c1fa791', 'Chanelle Moon', 'Chanelle Moon Thomas',  '2003-06-14', 'Main Vocalist, Rapper',           'fiftyfifty-chanelle-moon'),
  ('932afbf4-dd4a-49e9-98b3-fa519c1fa791', 'Yewon',         'Son Yewon',             '2005-03-18', 'Lead Vocalist',                   'fiftyfifty-yewon'),
  ('932afbf4-dd4a-49e9-98b3-fa519c1fa791', 'Hana',          'Lim Haram',             '2006-09-05', 'Main Vocalist, Dancer',           'fiftyfifty-hana'),
  ('932afbf4-dd4a-49e9-98b3-fa519c1fa791', 'Athena',        'Athena Yang',           '2007-03-15', 'Vocalist',                        'fiftyfifty-athena'),
  ('1db0493d-c539-4e08-9b05-b2995b621c47', 'Navi',          'Kim Nahyun',            '2003-04-13', null,                              'secretnumber-navi'),
  ('1db0493d-c539-4e08-9b05-b2995b621c47', 'Dinda',         'Dinda Putri Maharani',  '2003-08-22', null,                              'secretnumber-dinda'),
  ('1db0493d-c539-4e08-9b05-b2995b621c47', 'Ebin',          'Jeong Hyebin',          '2004-01-28', null,                              'secretnumber-ebin'),
  ('1db0493d-c539-4e08-9b05-b2995b621c47', 'Min C',         'Min Seo',               '2006-04-21', null,                              'secretnumber-min-c'),
  ('19850eb6-fbcf-46ed-9623-0c7d0b334d9e', 'Lee Chanhyuk',  'Lee Chanhyuk',          '1996-09-12', 'Vocalist, Producer',              'akmu-lee-chanhyuk')
) as v(gid, stage, real, bday, pos, slug)
where not exists (
  select 1 from public.members m
  where m.group_id = v.gid::uuid and lower(m.stage_name) = lower(v.stage)
);

-- Keena (FIFTY FIFTY) : changement de nom légal (sept. 2024).
update public.members set real_name = 'Song Yuni'
where slug = 'fiftyfifty-keena' and real_name = 'Song Jagyoung';
