-- `profiles` : la base autorisait ce que le code refuse.
--
-- La policy « profiles: update own » ne vérifie que la PROPRIÉTÉ de la ligne,
-- jamais le CONTENU des colonnes — et une policy RLS ne sait pas travailler
-- colonne par colonne. Or la clé anon est dans le bundle : un compte peut
-- écrire directement en PATCH PostgREST, sans jamais passer par nos actions.

-- ───────────────────────────────────────────────────────────────────────────
-- 1) `avatar_url` pointait où on voulait.
--
-- Fuite d'IP : le composant Avatar sert l'URL BRUTE (sans proxy) dès qu'elle
-- contient « /storage/v1/object/ ». Un `avatar_url` posé à
-- `https://attaquant.example/storage/v1/object/pixel.png` satisfait ce test :
-- le navigateur de CHAQUE lecteur du fil va alors chercher l'image chez
-- l'attaquant, qui récolte les IP et les User-Agent de tous les visiteurs.
-- Sans même ça, n'importe quelle image distante pouvait servir d'avatar.
--
-- On contraint l'URL au dossier de l'utilisateur dans NOTRE bucket : ni un
-- autre hôte, ni le dossier d'un autre compte.
alter table public.profiles drop constraint if exists profiles_avatar_url_own_bucket;
alter table public.profiles
  add constraint profiles_avatar_url_own_bucket
  -- ANCRÉ SUR L'HÔTE, pas sur une sous-chaîne. Première version écrite avec
  -- `like '%/storage/v1/object/…'` : le `%` de tête matchait aussi l'hôte de
  -- l'attaquant, la contrainte laissait donc passer exactement ce qu'elle
  -- devait bloquer. C'est l'exercice en bas de ce fichier qui l'a attrapé.
  check (
    avatar_url is null
    or avatar_url like
       'https://lgewrmrbksgtjmzzebhz.supabase.co/storage/v1/object/public/avatars/'
       || id::text || '/%'
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 2) `username` : le charset n'était appliqué que côté application.
--
-- `profiles_username_len` bornait la longueur, rien d'autre. `normalizeUsername`
-- (src/lib/profiles/validation.ts) impose `^[A-Za-z0-9_]+$` — un PATCH direct
-- le contournait, et le pseudo s'affiche partout (commentaires, /u/<username>,
-- fil d'Ariane). Des caractères de direction ou des homoglyphes y auraient leur
-- place sans ce garde.
alter table public.profiles drop constraint if exists profiles_username_charset;
alter table public.profiles
  add constraint profiles_username_charset
  check (username is null or username ~ '^[A-Za-z0-9_]+$');

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Vérification : les deux contraintes doivent refuser, et le cas légitime
--    passer. Tout est annulé.
do $$
declare
  uid uuid;
  ok boolean;
begin
  select id into uid from public.profiles where avatar_url is not null limit 1;
  if uid is null then
    raise notice 'aucun profil avec avatar, exercice sauté';
    return;
  end if;

  -- a) un hôte étranger déguisé en URL de storage doit être refusé
  ok := false;
  begin
    update public.profiles
    set avatar_url = 'https://attaquant.example/storage/v1/object/public/avatars/' || uid::text || '/x.png'
    where id = uid;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'avatar_url : hôte étranger ACCEPTÉ'; end if;

  -- b) le dossier d'un autre compte doit être refusé
  ok := false;
  begin
    update public.profiles
    set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/00000000-0000-0000-0000-000000000000/x.png'
    where id = uid;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'avatar_url : dossier d''autrui ACCEPTÉ'; end if;

  -- c) un pseudo hors charset doit être refusé
  ok := false;
  begin
    update public.profiles set username = 'ab' || chr(8237) || 'cd' where id = uid;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'username : caractère de direction ACCEPTÉ'; end if;

  raise exception 'rollback_exercice';
exception
  when others then
    if sqlerrm <> 'rollback_exercice' then raise; end if;
end;
$$;
