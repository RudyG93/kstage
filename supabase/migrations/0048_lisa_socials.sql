-- R8.1 (2026-07-14) : Lisa (BLACKPINK) — réseaux corrigés.
-- seed-artist-links avait collé TOUT le bloc social de LiSA (chanteuse JP,
-- homonyme MusicBrainz score 100) car la recherche par nom court (limit=5) ne
-- voyait pas la vraie Lisa (KR, rang ~17). Seul le spotify avait été corrigé (R8)
-- → bloc Frankenstein. Valeurs vérifiées (infobox fandom « Lisa (BLACKPINK) » :
-- {{Instagram|lalalalisa_m}} + MBID 30aeb57f). Le correctif de FOND est dans
-- scripts/roster/seed-artist-links.ts (limit 25 + country KR requis) pour ne pas
-- ré-introduire la classe au prochain re-seed.
update public.groups
set links = jsonb_build_object(
  'spotify', 'https://open.spotify.com/artist/5L1lO4eRHmJ7a0Q6csE5cT',
  'instagram', 'https://www.instagram.com/lalalalisa_m/',
  'youtube', 'https://www.youtube.com/channel/UC35HKvKYPkri4Grd5KXl3wQ',
  'tiktok', 'https://www.tiktok.com/@lalalalisa_m',
  'weibo', 'https://www.weibo.com/lisaofficial',
  'deezer', 'https://www.deezer.com/artist/145068682',
  'tidal', 'https://tidal.com/artist/28344561',
  'apple_music', 'https://music.apple.com/kr/artist/1583908668',
  'amazon_music', 'https://music.amazon.com/artists/B09FPM7C9K'
)
where slug = 'lisa';
