# Audit de nuit — 2026-08-21

> Demande de Rudy : rendre les remèdes de `/admin/health` réellement opérants, puis passer l'app entière en revue et livrer un bilan. Méthode : diagnostic en données réelles (SQL prod, API YouTube, wikitext fandom), puis audit multi-agents sur 6 dimensions (données, UX, scraping, concurrence, code, perf/a11y) avec vérification adversariale de chaque finding important.
>
> **Statut** : les causes racines sont corrigées et mesurées ; le reste est priorisé ci-dessous. Les points barrés sont faits cette nuit.

## 1. Pourquoi les remèdes ne résolvaient rien (cause racine)

Le reproche « quoi que je fasse, ça ne change rien » était **entièrement fondé**, pour trois raisons distinctes — aucune ne pouvant être réglée en relançant un cron.

| Bloc affiché           | Ce qui bloquait réellement                                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Catalogues MV maigres  | Les MV d'un groupe vivent souvent sur la **chaîne de son label**, jamais scrapée. OURBIRTHDAY : sa propre chaîne ne contient que 84 Shorts, son MV « SQUEEZY » est sur la chaîne **JYP Entertainment**. Aucun nombre de relances ne pouvait le trouver.                              |
| Le bouton « discover » | La découverte passe par `search.list` : **100 units par requête**, sur un quota de recherche étroit. Le 20/08, `discover-channels` a consommé **3 884 units et fini en HTTP 429** — quota épuisé pour la journée. Le bouton affichait quand même « Lancé ✓ ».                        |
| Membres sans photo     | Ce ne sont pas des photos manquantes mais des **données pourries** : `the-wind` contenait 5 musiciens d'un groupe **indie américain** (mauvais match MusicBrainz), `el7z-up` et 7 autres groupes des noms au format « Kim, Yeon-hee ». Aucune photo fandom ne peut exister pour eux. |

### Ce qui a été mis en place

- ~~**Nouveau pipeline `recover-mvs`**~~ : les pages fandom de sorties citent le lien YouTube du MV **quelle que soit la chaîne**. Coût **~2 units par groupe** au lieu de ~205. Branché sur le pipeline existant (tous les gates conservés : titre officiel, appartenance, durée ≥ 75 s, dédup, slug, mv_kind). Cron quotidien + remède 1-clic.
- ~~**Passe de masse mesurée**~~ : **123 MV récupérés sur 25 groupes pour 205 units au total** — WayV 0→20, chungha 5→20, ZICO 4→17, colde 4→16, RESCENE 5→12, the-wind 3→12, lun8 2→12. chungha et ZICO étaient documentés comme « restes coriaces » depuis le 20/08.
- ~~**Title-match élargi**~~ : `normalize` passe en NFKD (avant `toLowerCase` — les capitales mathématiques n'ont pas de minuscule). « 𝗩𝟴 'singasong' Official MV » et « ＡＥＳＰＡ » ne matchaient pas. Alias hangul/hanja/romanisation désormais alimentés depuis l'infobox (MiiWAN : 0 MV malgré 33 vidéos trouvées, ses MV sont titrés 미완소년).
- ~~**Boucle de retour**~~ : le bouton interroge `scrape_log` et affiche ce que le run a produit (« 12 MV récupérés sur 4 groupes », « ⚠ quota épuisé ») au lieu d'un « Lancé ✓ » aveugle.
- ~~**`discover-channels` ramené de 20 à 3 groupes/run**~~ : il n'est plus le moteur, juste un complément.

## 2. Données corrigées en base

- ~~3 groupes affichaient le catalogue d'un **artiste étranger homonyme**~~ : GENUS ← death metal italien, Puzzle ← Shota Shimizu (solo japonais), TOZ ← groupe turc. 6 events + 3 sources purgés. **La source légitime de TOZ (YY Entertainment) a été préservée** — l'audit proposait une purge globale qui aurait détruit de la vraie donnée.
- ~~Garde anti-homonyme ajoutée~~ : une chaîne n'est seedée que s'il existe un **signal k-pop** (hangul dans un titre, ou chaîne = groupe / son agence). `matchesGroup` compare sans séparateurs, donc un nom court est contenu dans celui d'un artiste étranger.
- ~~**40 idols sans slug**~~ → sans page, invisibles de la recherche et du sitemap : rosters entiers de NCT 127, NCT DREAM, Hearts2Hearts, izna, QWER, plus G-Dragon. Slugs backfillés.
- ~~Doublons de personnes~~ : EVNNE avait **9 rows pour 5 membres** (« Hanbin » + « Park, Han-bin »), MADEIN 7 pour 4. Fusionnés en conservant les données (birthday) ; Suhye et Yeseo passées en `former` (elles figurent au champ _former_ de fandom, ce ne sont pas des erreurs). OURBIRTHDAY « Yu » (doublon de « U ») et UDTT « Lu Yuting (Jessica) » supprimés.
- ~~5 faux membres de `the-wind`~~ (les musiciens du groupe indie américain) supprimés.
- ~~`debut_date` d'OURBIRTHDAY~~ : 22/07 était la sortie **pre-debut** « Hungry (Side A) » ; le vrai debut est le **19/08** — d'où le bandeau au mauvais moment.
- ~~Alias parasites purgés~~ : mon premier scan avait inséré « | origin = Seoul », « South Korea » dans `name_aliases` (débordement de champ d'infobox). Comme les alias alimentent un match par sous-chaîne, « South Korea » aurait capté n'importe quel titre. Validateur ajouté + 16 groupes nettoyés. **Contrôle** : les 123 MV insérés cette nuit ont été relus un par un — aucun faux positif.

## 3. Corrigé côté plateforme

- ~~**Sitemap tronqué à 1 000 URLs par type**~~ : `.range(0, 4999)` ne contourne pas le plafond serveur PostgREST. **1 929 MV sur 2 929 et 234 artistes étaient invisibles des moteurs.** Pagination réelle.
- ~~**HTTP 429 non reconnu comme quota**~~ : l'API renvoie 429 (et non 403) pour le quota de recherche — la boucle continuait à taper une clé morte.
- ~~**Statut de run crédible**~~ : **une** source cassée sur 326 mettait `scrape-youtube` en `partial` à chaque exécution depuis des jours. Le statut criait au loup en permanence, donc plus personne ne le lisait. Seuil : ≥ 5 sources ou > 5 % d'échecs ; la santé d'une source isolée reste suivie par le check `stale_sources`.
- ~~**Check « rookies » honnête**~~ : il affichait « normal, en construction » pour un groupe débuté sans aucun MV. C'est faux — Rudy avait raison. Nouveau check `debuted_without_mv` en `warn`, avec le remède qui va chercher le MV.
- ~~Nouveaux checks anti-récurrence~~ : `members_without_slug`, `member_sort_names`, `groups_without_members`.

## 4. Ce qui reste — par priorité

### P1 — visible par un utilisateur, non traité cette nuit

1. **Le calendrier n'est pas plein** : 41 events futurs sur 30 jours, 26 groupes sur 253. C'est la promesse centrale de l'app. kpopofficial plafonne à mois courant + suivant, Wikipedia ne produit que 2 events/30 j (224 lignes sur 235 jetées à chaque run), et 40 % des entrées parsées ne matchent aucun groupe.
2. **Doublons et classification de MV** : 17 doublons visibles (9 versions chinoises EXO le même jour, 8 reuploads FNC) ; 79 remix / versions japonaises classés `mv_kind='main'` polluent les comebacks ; IVE affiche 3 MV de SISTAR/JUNGGIGO/Jooyoung (même classe d'homonymie sur chaînes de label — la garde posée cette nuit protège les futurs seeds, ces lignes-là restent à purger).
3. ~~**Music shows troués**~~ **— TRAITÉ le 2026-08-21 au soir** : bascule sur les chaînes des diffuseurs (`docs/SCRAPING.md §3.25`). +291 passages, 91,5 % avec vidéo, numérotation réalignée. Reste ouvert : les 113 artistes hors roster (file `lineup_unmatched`, décision produit).
4. **Perf mobile** : `/groups` LCP 4,37 s en 3G — les tuiles sont téléchargées en 600×600 pour une boîte de 177 px, sans `srcset`. 201 Ko de woff2 préchargés sur chaque page dont 132 Ko non critiques (mesuré : −288 ms FCP, −364 ms LCP en les retirant). Le client Supabase Realtime (67 Ko brotli) part sur 6 pages sur 7 pour un rail secondaire.
5. **Une sortie (release) n'a pas de page** : le hero « D-DAY » renvoie sur la fiche du groupe.
6. **Aucun retour après connexion** : tous les CTA « Sign in » ramènent à la home au lieu de la page d'origine.

### P2 — qualité et confiance

- Partage social : sur X, tous les liens affichent le titre générique du site ; la description d'une page MV est le dump brut de YouTube ; les pages artiste n'ont aucune image de partage.
- Accessibilité : les tokens sont audités AA, mais chaque recomposition (`/70`, `opacity-60`, `color-mix`) repasse sous 4,5:1 — 42 nœuds confirmés. L'input de filtre du calendrier est en 12 px → iOS zoome au focus (le bon pattern existe déjà sur la recherche du header).
- Le vocabulaire de sortie n'est pas normalisé (« 8th Mini Album », « Digital Single » sont des standards du domaine, absents chez nous).
- 105 groupes sur 253 sans agence ; `color_hex` NULL pour 245/253 (toutes les cartes tombent sur la couleur de repli) ; 571 membres actifs sur 1 210 sans date de naissance.
- Hygiène : docs d'audit périmées et handoffs design (~0,5 Mo) à la racine ; `passWithNoTests: true` (une suite vide sortirait en vert) ; `createFromPayload` (700 lignes d'idempotence) n'a aucun test.

### P3 — idées issues de la veille concurrentielle

Les plus transposables, dans l'ordre recommandé :

1. **Le comeback est une ère, pas une date** (kpopofficial, straykidscomebackguide) : teaser → concept photos → tracklist → MV teaser → sortie → stages. Afficher la séquence donne de la matière quotidienne là où une date isolée ne remplit rien.
2. **Import Spotify pour amorcer les follows** (Songkick et Bandsintown importent jusqu'à 400 artistes) : remplace le mur de 200 tuiles à l'onboarding — c'est leur hook d'acquisition historique.
3. **Alerte par event + snooze** (Trakt règle l'alarme dans l'ICS ; Songkick alerte avant l'ouverture de la billetterie) plutôt qu'un on/off global par type.
4. **Diary + stats perso** (Letterboxd, Serializd) : la seule mécanique de rétention qui **ne dépend pas de l'audience** — pertinent tant qu'il n'y a pas d'utilisateurs.
5. **Cartes countdown partageables** : le fandom fabrique ces visuels « D-7 » à la main sur Canva ; les générer est un canal de diffusion gratuit.
6. **Flux ICS par groupe + API publique en lecture** (l'API d'AniList a fait naître tout un écosystème gratuit qui lui renvoie du trafic).
7. **Music show comme objet suivable**, avec les fenêtres de pré-vote comme events datés (Mubeat, Idol Champ possèdent la boucle quotidienne du fandom grâce à ces deadlines).
8. **Dire explicitement le fuseau affiché** et garder KST en double (animeschedule : « All times in your timezone (EDT) »).

## 5. Deux corrections d'analyse

- Le TTFB **n'est pas** un problème : 75-150 ms à chaud. Les pics à 1,2 s mesurés au premier passage étaient des démarrages à froid de lambda. Le serveur est bien réglé ; ce qui coûte est côté client (images, polices, JS).
- Le finding « le h1 est livré dans un `<div hidden>` » est un **faux positif** : c'est le mécanisme normal du streaming Suspense de React (contenu réinséré par JS). Vérifié en prod, `/groups/ourbirthday` a bien son `h1`.

## 6. « Trop de groupes ? » — analyse chiffrée (question de Rudy, 21/08)

Intuition : « on a beaucoup de groupes quasi inconnus ou inactifs, avec un MV ou deux, dans des agences peu connues ». Les chiffres la **nuancent nettement** — sur 256 groupes (dont 38 solos, 3 dissous) :

| Mesure                                       | Valeur         |
| -------------------------------------------- | -------------- |
| Ont sorti quelque chose ces 12 derniers mois | **200 (78 %)** |
| Silencieux depuis 12-24 mois                 | 28             |
| Silencieux depuis plus de 24 mois            | 28             |
| Sans aucun MV                                | 9              |
| 1 à 2 MV seulement                           | 46             |
| N'ont jamais rien sorti                      | **0**          |

**Le point important** : les « inactifs » ne sont pas des inconnus. La liste des silencieux depuis 18 mois et plus contient **NewJeans** (26 MV, hiatus judiciaire), **iKON** (41), **FTISLAND** (56), **PENTAGON** (18), VICTON, ONEUS, Kang Daniel, MCND, OnlyOneOf. Un fan qui cherche NewJeans doit les trouver : les supprimer serait une régression, pas un nettoyage.

Les vrais creux se comptent à **13 groupes** : `kandis, geenius, puzzle, forte-na, el7z-up, stellive, cherish, triple-iz, aria, heartsteel, b-d-u, tribe, bewave` (≤ 1 MV **et** silencieux depuis 18 mois).

**Diagnostic** : le problème n'est pas le NOMBRE, c'est l'ABSENCE DE HIÉRARCHIE. Dans l'annuaire, rien ne distingue NewJeans d'un groupe à 1 MV sorti en 2023 — même tuile, même poids. C'est ça qui donne la sensation d'une base diluée.

**Recommandation — classer plutôt que supprimer** (réversible, et ça sert aussi le produit) :

1. **Statut d'activité dérivé** (aucune saisie manuelle) : `actif` (sortie < 12 mois) · `en pause` (12-24 mois) · `dormant` (> 24 mois). Calculé depuis la dernière sortie.
2. **L'annuaire trie par activité** : les actifs d'abord, les dormants en fin de liste ou derrière un filtre « inclure les groupes en pause ». Un fan de NewJeans les trouve toujours par la recherche.
3. **Les checks santé cessent de compter les dormants** comme des anomalies : un groupe en pause à 2 MV n'est pas un défaut de scraping, et il pollue aujourd'hui le compteur « catalogue maigre ».
4. **Les 13 creux réels** : revue manuelle ponctuelle — soit compléter (leur MV existe peut-être sur la chaîne d'un label, ce que `recover-mvs` sait maintenant faire), soit masquer de l'annuaire sans supprimer.
5. **L'entrée est déjà durcie** : le gate d'auto-création exige un signal d'audience réel (YouTube ≥ 10k abonnés ou Deezer ≥ 5k fans). Le flux entrant n'est donc plus le problème ; c'est le stock historique qui est hétérogène.

À trancher par Rudy : le point 2 est un choix produit (montrer tout le catalogue vs mettre en avant le vivant).
