-- `groups.mv_recovery_checked_at` — arrêter de redemander chaque jour à fandom
-- ce qu'il a déjà répondu la veille.
--
-- `recover-mvs` sélectionne les groupes actifs à catalogue maigre (≤ 5 MV),
-- triés par nombre de MV croissant. Le tri est STABLE et le pool (89 groupes au
-- 2026-08-25) tient sous le plafond de 120 : les MÊMES groupes sont donc
-- re-scannés intégralement à chaque run, tous les jours.
--
-- Rendement mesuré sur les 3 runs journalisés : 89 à 102 groupes scannés pour
-- 0 à 3 insertions. Le détail des refus est sans appel —
--   « aucun MV nouveau retenu par les gates » : 72 à 84 groupes
--   « aucune sortie listée ni lien YouTube »  : 10 à 11
--   « page fandom introuvable »               : 2
-- soit ~95 % de requêtes qui reposent une question déjà tranchée.
--
-- Ce volume n'est pas qu'un gaspillage, c'est la CAUSE du timeout : les
-- requêtes fandom sont séquentielles et le run a été tué à 304 s (maxDuration
-- 300) sur 3 runs planifiés sur 4. Avec une fenêtre de re-vérification de
-- 7 jours, chaque run ne traite plus qu'une douzaine de groupes.
--
-- L'horodatage est posé à CHAQUE tentative, y compris en échec : c'est lui qui
-- fait tourner la file. Ne marquer que les succès ramènerait indéfiniment en
-- tête les groupes qui échouent — exactement le défaut corrigé le même jour sur
-- `image_checked_at` (migration 0073), où les 95 groupes sans lien Spotify
-- bloquaient la fenêtre pour toujours.
alter table public.groups add column if not exists mv_recovery_checked_at timestamptz;

comment on column public.groups.mv_recovery_checked_at is
  'Dernière tentative de récupération de MV via la discographie fandom (cron recover-mvs), succès OU échec. NULL passe en premier.';

-- Index partiel : la requête ne lit que les groupes encore actifs.
create index if not exists groups_mv_recovery_checked_at_idx
  on public.groups (mv_recovery_checked_at nulls first)
  where disbanded_on is null;
