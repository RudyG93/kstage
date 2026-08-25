-- `events.lineup_state` — distinguer un passage ANNONCÉ d'un passage DIFFUSÉ.
--
-- Deux chaînes écrivent dans `events` sur la même clé, sans se distinguer :
-- le cron `scrape-music-shows` insère les lineups ANNONCÉS (170 des 227
-- passages des 30 derniers jours), et `aired-shows` crée les passages PROUVÉS
-- par une vidéo du diffuseur. Rien ne les sépare une fois en base.
--
-- Conséquence mesurée, visible en prod : M Countdown du 2026-08-13 (le spécial
-- « Summer Camp ») affiche 22 stages. 12 ont été créés le 21/08 par la preuve
-- vidéo — tous en ont une. 10 ont été insérés le 07/08 par l'annonce, dont
-- **9 sans aucune vidéo** : ces groupes ne sont jamais passés. Et la page
-- `/groups/kissoflife` lie 4 fois vers ce passage qui n'a pas eu lieu.
--
-- Le calcul EXISTE déjà — `aired-lineups.ts` étape 5 produit exactement ces
-- trois ensembles à chaque run — mais il n'est poussé que dans un log. Cette
-- colonne lui donne où atterrir.
--
--   announced   : annoncé, épisode pas encore diffusé (ou pas encore évalué).
--   aired       : une vidéo du diffuseur nomme le groupe sur cet épisode.
--   unconfirmed : épisode diffusé, harvest bien couvert, aucune vidéo ne le
--                 nomme.
--
-- La preuve est `videosByGroup`, PAS `stage_url` : sur 30 jours, 39 passages
-- n'ont pas de `stage_url` mais seulement 30 n'ont aucune vidéo — 9 sont bien
-- passés, leur vidéo n'a simplement pas franchi le scoring ou la durée. Déduire
-- l'état de `stage_url` inventerait 9 fantômes par mois.
--
-- NULLABLE À DESSEIN. Les 775 lignes existantes ne sont pas rétro-marquées :
-- poser `announced` par défaut affirmerait quelque chose qu'on n'a pas vérifié.
-- NULL veut dire « pas évalué », et l'affichage le traite comme aujourd'hui.
-- Le prochain run d'`aired-shows` couvre une fenêtre de 28 jours et remplira
-- ce qui compte, à partir de la preuve — jamais d'un UPDATE en masse.
--
-- L'étiquetage ne SUPPRIME jamais rien : c'est la garantie demandée
-- (« oui tant pis, au moins pour l'information »). Un passage requalifié reste
-- en base et reste affichable, il cesse simplement d'être présenté comme un
-- fait établi.
--
-- Préalable levé le 2026-08-25 : 93 alias hangul ajoutés (131 groupes n'en
-- avaient aucun). Sans eux, un groupe dont la vidéo est titrée en coréen aurait
-- été marqué « non diffusé » à tort — 23 des 30 cas suspects concernaient des
-- groupes à `name_aliases = []`.
alter table public.events
  add column if not exists lineup_state text
  check (lineup_state in ('announced', 'aired', 'unconfirmed'));

comment on column public.events.lineup_state is
  'Passage music show : announced (annoncé) / aired (vidéo du diffuseur le nomme) / unconfirmed (épisode bien couvert, aucune vidéo). NULL = pas encore évalué.';

-- Les deux lectures qui filtrent dessus (page groupe, check santé) portent sur
-- les passages music_show.
create index if not exists events_lineup_state_idx
  on public.events (lineup_state)
  where type = 'music_show';
