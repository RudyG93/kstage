-- R4-C (2026-07-13) : corrections de rosters — audit global des ex-membres.
--
-- Constat (JOURNAL 2026-07-13) : 32 membres encore « active » alors qu'ils ont
-- quitté leur groupe (vérifiés un à un sur Wikipedia le 2026-07-12), un doublon
-- FTISLAND (Jonghoon actif + Jonghun former = la même personne, Choi Jong-hoon),
-- et aucun moyen de modéliser un groupe dissous (CIX avril 2026, Loossemble
-- novembre 2024). Cause racine : les rosters sont seedés à une date T et
-- jamais re-validés — 7 de ces départs sont POSTÉRIEURS au seed.
--
-- Politique : status='former' + former_reason au format existant
-- (« Left the group in <Month Year> »). Les groupes dissous gardent leurs
-- membres 'active' (c'est le groupe qui s'arrête, pas les membres qui partent)
-- et portent groups.disbanded_on.

-- 1. Modélisation groupe dissous ---------------------------------------------
alter table public.groups add column if not exists disbanded_on date;
comment on column public.groups.disbanded_on is
  'Date de dissolution/fin d''activité annoncée. NULL = groupe actif.';

update public.groups set disbanded_on = '2026-04-29' where slug = 'cix';
update public.groups set disbanded_on = '2024-11-29' where slug = 'loossemble';

-- 2. Doublon FTISLAND : fusionner « Jonghun » (former, slug NULL) dans
--    « Jonghoon » (la row avec slug/photo), qui devient former. -------------
update public.events set member_id = '1f33030d-d9ec-4027-8f4c-cbd713f97e56'
  where member_id = '31e6f75f-d278-424e-9461-87be123b3f83';
update public.members set canonical_id = '1f33030d-d9ec-4027-8f4c-cbd713f97e56'
  where canonical_id = '31e6f75f-d278-424e-9461-87be123b3f83';
delete from public.members where id = '31e6f75f-d278-424e-9461-87be123b3f83';

-- 3. Les 32 départs (ids vérifiés en prod le 2026-07-13) ---------------------
update public.members set status = 'former', former_reason = v.reason
from (values
  ('1609bc06-7602-4be0-8d56-71c0f19867c6'::uuid, 'Left the group in July 2022'),      -- LE SSERAFIM Kim Garam
  ('b8e05a5a-0083-41f9-a0d1-1b46d5f94fa1', 'Left the group in December 2021'),        -- DAY6 Jae
  ('709616ac-f7b2-4f5e-ad4d-167bd4d7b13b', 'Left the group in December 2020'),        -- BTOB Ilhoon
  ('d6a19e12-72a2-4fd8-bb6f-04118930a73d', 'Left the group in November 2022'),        -- TREASURE Yedam
  ('7fb2e1ca-8110-4166-873f-cd5aa292c7ec', 'Left the group in November 2022'),        -- TREASURE Mashiho
  ('d7cfb7a7-39d4-449e-be61-743250612ee5', 'Left the group in July 2022'),            -- fromis_9 Jang Gyuri
  ('30898686-39f2-4daa-9e4b-d92f01de2560', 'Left the group in February 2025'),        -- fromis_9 Lee Saerom
  ('78288f4e-0668-4bf2-8ed3-dd0997a3f623', 'Left the group in February 2025'),        -- fromis_9 Noh Jisun
  ('0dd99eb0-0236-481f-a492-ff9f354da404', 'Left the group in February 2025'),        -- fromis_9 Lee Seoyeon
  ('f0493eb4-6527-4f30-bcdc-6b883183ecd6', 'Left the group in July 2024'),            -- Kep1er Mashiro
  ('93f06cba-bb0b-4d41-8f14-fbba4338a183', 'Left the group in July 2024'),            -- Kep1er Yeseo
  ('15d4a186-5a26-4399-b80e-d82b1bf4f15b', 'Left the group in March 2026'),           -- Kep1er Youngeun
  ('16f1a9ce-d3a3-467a-a299-804121383c27', 'Left the group in October 2017'),         -- Oh My Girl JinE
  ('7091ff63-b920-47e8-9070-bb2e63fa4f7f', 'Left the group in October 2024'),         -- RIIZE Seunghan
  ('7da0f3ef-5028-49e9-a0cb-4665500c1af1', 'Left the group in December 2022'),        -- NMIXX Jini
  ('e27d8c73-1c76-4ada-a00f-8c058fcacee0', 'Left the group in March 2019'),           -- Highlight Junhyung
  ('3732900c-8e94-40c3-884c-84478d24dcad', 'Left the group in October 2022'),         -- ONEUS Ravn
  ('fa7c7067-4997-4f63-8718-cac3be7b31fa', 'Left the group in December 2018'),        -- N.Flying Kwangjin
  ('1f5def17-3784-406f-8ab3-8117fe4fc1d4', 'Left the group in December 2019'),        -- FTISLAND Seunghyun
  ('1f33030d-d9ec-4027-8f4c-cbd713f97e56', 'Left the group in March 2019'),           -- FTISLAND Jonghoon
  ('1f43e18f-b255-4f8b-a708-100a72930b05', 'Left the group in October 2023'),         -- FIFTY FIFTY Saena
  ('7f575d08-a4e2-4503-8004-9a846e48b7a5', 'Left the group in August 2025'),          -- izna Jiyoon
  ('4aa03cbb-028b-4260-aef7-79f63f466768', 'Left the group in March 2026'),           -- ZB1 Zhang Hao
  ('c055fe40-2cd2-4287-8f09-32ceae3bf1ea', 'Left the group in March 2026'),           -- ZB1 Ricky
  ('e85b8b80-3179-4e69-ba10-f1e8e65d9562', 'Left the group in March 2026'),           -- ZB1 Gyuvin
  ('e444f7ad-b834-4132-ad2f-87f03016573f', 'Left the group in March 2026'),           -- ZB1 Yujin
  ('85b94257-61d5-43fb-87b4-5e5cd49ef8ee', 'Left the group in April 2025'),           -- Secret Number Lea
  ('6db38204-a597-490e-b6d4-d49a28ed0901', 'Left the group in April 2025'),           -- Secret Number Dita
  ('6a4d4997-582c-43ed-9520-0eb5786fa75e', 'Left the group in April 2025'),           -- Secret Number Jinny
  ('58c2cf49-5f02-4ead-86e5-d4e1fca15b01', 'Left the group in April 2025'),           -- Secret Number Minji
  ('71b2af88-3405-46f2-bd80-671f8ba8b88a', 'Left the group in December 2025'),        -- Secret Number Soodam
  ('1ac7b022-0c72-4de4-adc3-0185dc9b4ca4', 'Left the group in April 2026'),           -- Secret Number Zuu
  ('70043491-6850-42c8-9b2d-4e1c0653d94c', 'Left the group in 2023'),                 -- TRI.BE Jinha
  ('6ee56dd1-443f-43cb-b044-f37f39de7c27', 'Left the group in August 2024')           -- CIX Jinyoung
) as v(id, reason)
where members.id = v.id::uuid and members.status = 'active';
