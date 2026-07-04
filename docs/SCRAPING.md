# SCRAPING.md — Référence opérationnelle du scraping KStage

Document vivant. Mis à jour à chaque pièce nouvelle découverte ou résolue. Si tu travailles sur un fix scraper, **lis ce fichier en premier** : tous les pièges qu'on a déjà traversés sont listés ici pour éviter de re-galérer.

---

## 1. Architecture des sources

Table `sources` (cf. `supabase/migrations/0001_init.sql` + `0003_scraping.sql`) :

| Colonne           | Description                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | uuid PK                                                                                                                                                                                                                         |
| `name`            | label humain (ex. "aespa SMTOWN", "BABYMONSTER YouTube")                                                                                                                                                                        |
| `url`             | URL canonique de la chaîne YT (`https://www.youtube.com/@handle` ou `/channel/UC...`)                                                                                                                                           |
| `type`            | `youtube_api` \| `kpopofficial` \| `wikipedia` \| `music_shows` \| `community` (colonne `text`, pas un enum PG)                                                                                                                 |
| `group_id`        | FK vers `groups.id` (null pour sources groupe-agnostiques comme kpopofficial)                                                                                                                                                   |
| `last_scraped_at` | timestamptz du dernier run **ayant réellement récolté** (≥1 page/lineup fetchée — gaté depuis P0.3, 2026-06-12). Un run en échec total ne le rafraîchit plus : c'est le signal fiable pour détecter une source morte (query §5) |

**Convention** : pour les sources YT, on a **deux catégories** par groupe :

- **Chaîne officielle** (ex. `@aespa`, `@official_i_dle`) — porte les MVs récents, vlogs, performances, lives.
- **Chaîne d'agence** (ex. `@SMTOWN`, `@YGEntertainment`, `@HYBELABELS`, `@theunitedcube`) — peut porter des MVs (notamment historiques pour aespa via SMTOWN, NCT, SHINee), des collabs, des contenus exclusifs.

**Décision** : on garde TOUJOURS les deux (officielle + agence) même si une des deux ne ramène rien actuellement. _Future-proof_ : on ne sait pas ce qu'on voudra ingérer plus tard. La 2-pass scraping (voir §2) filtre proprement les contenus non pertinents.

---

## 2. Stratégie de scraping (pipeline playlistItems — P0.4, 2026-06-13)

Le scraper (`src/lib/scrapers/youtube.ts:scrapeGroup`) enchaîne :

1. **`channels.list`** (1 unit) — résout l'URL (`/channel/UC…` ou `@handle`) et renvoie en un appel : l'id de chaîne, la playlist **uploads**, et le `subscriberCount` (persisté dans `sources.channel_id` + `sources.subscriber_count`, migration 0032 — critère de popularité pour la sélection top-30, `spotify_followers` étant inalimentable).
2. **`playlistItems.list`** sur la playlist uploads (1 unit / page de 50, récents d'abord), borné par `maxPages` — défaut **2** (100 uploads récents : un nouveau MV est toujours en tête de playlist pour le cron quotidien). Le **backfill d'onboarding** d'une nouvelle source passe `maxPages` élevé pour remonter tout l'historique.
3. **Gates titre, gratuits** : `detectEventType === 'mv'` → gate strict `isOfficialMvTitle` (§4.1) → `matchesGroup` sur le **titre seul** (§3.10).
4. **`videos.list`** batché sur les seuls candidats survivants (1 unit / 50 ids) — apporte `liveBroadcastContent` + `liveStreamingDetails.scheduledStartTime` : une **premiere programmée devient un event daté dans le futur** (`pickStartAt`), le seul futur que YouTube puisse fournir.
5. Idempotence **batchée** (un seul `IN` sur les source_url candidats), dédup cross-chaînes (§3.9), slug, `mv_kind`, insert.

### Quota

**~3-4 units / source / run** (vérifié en réel le 2026-06-13 : 8 sources = 27-28 units) contre **200 avant** (2× `search.list` à 100 units/call). Free tier = 10 000 units/jour → des centaines de sources possibles en quotidien. Le 403 `quotaExceeded` est géré : `QuotaExceededError` → la route arrête les sources restantes proprement et `scrape_log` porte la raison.

> Historique : l'ancienne stratégie « 2-pass `search.list` » (Pass A `order=date` + Pass B `q="<groupe> Music Video"`) est remplacée. La Pass B existait pour contourner la fenêtre étroite d'`order=date` (§3.4) ; la pagination de la playlist uploads couvre l'historique au backfill pour 1 unit/50 vidéos.

### Limite connue : playlist uploads parfois incomplète (P0.5, 2026-06-15)

La playlist auto-générée `uploads` (`UU…`) d'une chaîne **n'inclut pas toujours toutes ses vidéos publiques**. Cas vérifié au backfill P0.5 : la chaîne `@roses_are_rosie` (Rosé) compte 92 uploads, mais son clip phare « ROSÉ & Bruno Mars - APT. (Official Music Video) » — pourtant hébergé sur cette chaîne (même `channelId` confirmé par `videos.list`) — **est absent de la playlist uploads** (seul le live Grammy y figure). `playlistItems.list` ne peut donc pas le récupérer, quel que soit `maxPages`.

Conséquence : les **chaînes perso de soliste** où le clip studio est exclu de la playlist uploads sont sous-couvertes (Rosé = 1 MV). Les **chaînes de label** (HYBE LABELS, SMTOWN, JYP…) exposent bien leurs MV dans leur playlist uploads — la majorité de la couverture passe par elles, donc l'impact reste circonscrit. C'est le prix de l'optimisation quota P0.4 (`playlistItems` à 1 unit/50 vs `search.list` à 100 units/call). Fallback éventuel (non implémenté) : `search.list?channelId=…&q="<artiste>"` pour ces cas, au coût de 100 units.

---

## 3. Pièges traversés et résolus

> Si tu touches au scraper, **vérifie chaque piège ci-dessous** dans tes changements. Chacun nous a fait perdre du temps en prod.

### 3.1 — HTML entities (résolu 2026-05-28)

**Symptôme** : titres en DB et dans l'UI affichent `aespa &#39;LEMONADE&#39; MV Teaser` au lieu de `aespa 'LEMONADE' MV Teaser`. Les slugs contiennent `aespa-39-lemonade-39-...`.

**Cause** : l'API YouTube renvoie les champs `snippet.title` et `snippet.description` avec des **entités HTML** (`&#39;` pour `'`, `&amp;` pour `&`, `&quot;` pour `"`, etc.). React rend `&#39;` littéralement comme texte.

**Fix** : `src/lib/scrapers/html-entities.ts` — décodeur `decodeHtmlEntities()` (décimal + hex + entités nommées) appliqué en entrée de la boucle scraper, avant tout usage aval (detectType, slug, insert). Backfill via `scripts/backfill-html-entities.ts`.

### 3.2 — Derivatives MV classés comme MV (résolu 2026-05-28)

**Symptôme** : la page `/mv/[slug]` se remplit de teasers, behind-the-scenes, et performance videos, pas de vrais clips.

**Cause** : `detectEventType` matchait `\bmv\b` → "MV Teaser", "MV Behind The Scenes", "Making of MV" passaient tous en `'mv'`.

**Fix** : `DERIVATIVE_RE` early-return `'other'` dans `detectEventType` (cf. `src/lib/scrapers/youtube.ts:31`). Markers exclus : `behind`, `teaser`, `trailer`, `making of`, `recording`, `rehearsal`, `practice`, `preview`, `highlight medley`, `schedule poster`, `recipe`, `cheering guide`, `performance video`, `dance practice`, `documentary`, `r(ae)cord`, `replay`, `compilation`, `episode`, `ep. N`, `vlog`.

### 3.3 — Mauvaise chaîne CUBE pour i-dle (résolu 2026-05-28)

**Symptôme** : ajout d'une source `@theunitedcube` (United Cube) pour i-dle. Scrape ramène 24 skipped / 0 MV inséré.

**Cause** : la chaîne `@theunitedcube` est l'**umbrella channel** de CUBE Entertainment, partagée entre BTOB, PENTAGON, CLC, i-dle, et d'autres artistes. Les MVs i-dle ne sont **pas** sur cette chaîne. Ils sont sur **`@official_i_dle`** (channel ID `UCritGVo7pLJLUS8wEu32vow`), qu'on scrapait déjà sans en récolter les MVs à cause du piège §3.4.

**Méthode de vérification** (à reproduire pour tout nouvel artiste — cf. §4) :

1. oembed YouTube : `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<videoId>&format=json` → renvoie `author_url` (la chaîne d'origine du MV).
2. Jina reader : `https://r.jina.ai/<youtube channel URL>` → liste les vidéos visibles + nom de chaîne + handle.

**Fix** : on garde `@theunitedcube` quand même (future-proof, peut héberger des collabs un jour) mais la 2-pass §2 ramène les MVs depuis la bonne chaîne.

### 3.4 — Fenêtre `maxResults=50` order=date trop étroite (résolu 2026-05-28)

**Symptôme** : 0 MV `type='mv'` en prod malgré 8 sources YT actives, alors que les chaînes officielles **contiennent** les MVs.

**Cause** : sur les chaînes officielles K-pop à fort débit d'uploads (i-log vlogs, i-talk episodes, performance videos, behind), les **50 uploads les plus récents** = ~1-2 mois. Les MVs (sortis tous les ~6 mois) sortent largement de cette fenêtre.

**Fix** : la 2-pass §2. Pass B utilise `q="${groupName} Music Video"` qui cible les MVs sur tout l'historique de la chaîne, indépendamment de la date.

> ⚠️ Fix remplacé en P0.4 (2026-06-13) : plus de Pass B — la pagination `playlistItems.list` de la playlist uploads couvre l'historique au backfill (`maxPages` élevé, 1 unit/50 vidéos). Le cron quotidien (`maxPages=2`) capte les nouveaux MVs en tête de playlist.

### 3.6 — Markers derivative en hangul + Reaction + Highlight Clip (résolu 2026-05-28 fin de journée)

**Symptôme** : après activation du fix §3.4 (2-pass search), 104 MVs ingérés, mais audit MCP révèle **18 derivatives mal classés** en `'mv'` (~17%). Patterns récurrents : 11 i-talk episodes "M/V 촬영 비하인드", 3 ILLIT "MV Reaction" / "MV 리액션", 1 SHEESH "M/V REACTION", 1 SHEESH "M/V Highlight Clip #Shorts", 1 CHOOM "M/V HIGHLIGHT CLIP", 1 aespa réagissant à un MV SHINee.

**Cause** : `DERIVATIVE_RE` n'avait que des markers latins. Or :

- Les chaînes officielles K-pop postent massivement en coréen. `비하인드` (behind), `메이킹` (making), `티저` (teaser), `리액션` (reaction), `현장` (on-site/scene), `예고` (preview) — aucun ne matchait.
- `\breaction\b` en anglais manquait aussi (seulement `replay` + `r(ae)cord` étaient là).
- `highlight clip` (différent de `highlight medley` qui était déjà couvert).

**Fix** : étendre `DERIVATIVE_RE` avec les 6 markers hangul + `reaction` EN + `highlight clip` EN. Tests Vitest pour chaque pattern. Script `scripts/backfill-reclassify-mvs.ts` re-run `detectEventType` sur tous les `type='mv'` et demote en `'other'` les nouveaux matches.

**Méthode de découverte** (à reproduire après chaque scrape massif) :

```sql
-- Détecte les derivatives potentiels mal classés
select e.slug, e.title
from events e
where e.type = 'mv'
  and (
    e.title ~ '비하인드|메이킹|티저|리액션|현장|예고'
    or e.title ~* '\breaction\b|\bhighlight clip\b'
  );
```

Si la query renvoie quelque chose, lancer le backfill script.

### 3.7 — Faux anniversaries par "Debut" keyword (résolu 2026-05-28 soirée)

**Symptôme** : 6 events `type='anniversary'` apparaissent en DB après scrape, alors que les anniversaires sont censés être générés à la volée (cf. `src/lib/events/anniversaries.ts`). Exemples :

- BABYMONSTER — 'DREAM' (PRE-DEBUT SONG)
- BABYMONSTER — DEBUT MEMBER ANNOUNCEMENT REACTION
- BABYMONSTER — 'BATTER UP' DANCE PERFORMANCE (DEBUT SPECIAL)
- ILLIT — 'Magnetic' #IROHA Focus | PRESS START♥︎
- 미연의 JJ50th Anniversary Fest 2026 비하인드 [i-talk] #248

**Cause** : la regex `/anniversary|debut/` dans `detectEventType` matchait tout titre contenant "Debut" ou "Anniversary" — un mot fréquent dans les retro-clips et descriptions K-pop.

**Fix** : retirer entièrement la ligne `if (/anniversary|debut/.test(lower)) return 'anniversary'` du scraper (cf. `youtube.ts:52`). Les anniversaires sont auto-générés à la volée par `generateAnniversaries()` depuis `members.birthday` + `groups.debut_date` ; le scraper n'a pas à en produire.

**Backfill prod** :

```sql
update events set type='other'
where type='anniversary' and source_url like 'https://www.youtube.com/%';
```

**Méthode de découverte récurrente** : `SELECT count(*), source_url IS NULL FROM events WHERE type='anniversary' GROUP BY source_url IS NULL;` — si on voit des `false` (source_url non-null) c'est qu'un scraper a injecté des fakes.

### 3.5 — Filtre nom de groupe vs variantes Hangul/typographiques (résolu 2026-05-28)

**Symptôme** : MVs i-dle dont le titre est en hangul (`(여자)아이들 'Klaxon' Official Music Video`) ne sont pas reconnus comme "i-dle".

**Cause** : `matchesGroup` normalise avant comparaison (`normalize(text).includes(normalize(groupName))`). `normalize("i-dle") = "idle"`. `normalize("(여자)아이들 (G)I-DLE 'Klaxon' MV") = "여자아이들gidle..."` → contient `"idle"` à partir de la position 1 dans `"gidle"` → **match**.

**Note** : `normalize` est Unicode-aware (`[^\p{L}\p{N}]+/gu`) pour garder hangul/kana, contrairement à la version ASCII-only de `kpopofficial.ts`. Les deux ne sont pas interchangeables.

### 3.10 — Faux positif d'attribution via la description (résolu 2026-06-13, P0.4)

**Symptôme** : « [그녀의 버킷리스트 OST] 이창섭(LEE CHANGSUB) – '너를 그리워하는 밤' MV » (un OST de Lee Changsub, BTOB) inséré comme MV **i-dle**, daté 2021, via la chaîne umbrella United CUBE.

**Cause** : le filtre groupe passait `${title} ${description}` à `matchesGroup`. Or les descriptions des chaînes d'agence se terminent par un boilerplate de hashtags listant **tous** leurs artistes (`#미연 #빅톤 #VICTON #여자아이들 #GIDLE #비투비 #BTOB`) → `normalize("#GIDLE")` contient `"idle"` → match (c'est le mécanisme du §3.5, légitime sur les titres, qui se retourne contre nous sur les descriptions).

**Fix** : `matchesGroup` sur le **titre seul**. Convention k-pop : le titre d'un MV officiel porte toujours l'artiste. Trade-off assumé : un MV dont le titre ne mentionne ni le groupe ni un alias serait raté sur une chaîne d'agence — cas rare, et la chaîne officielle du groupe le porte de toute façon.

**Méthode de découverte récurrente** : tout insert dont le titre ne contient pas le nom du groupe mérite un œil — `select g.name, e.title from events e join groups g on g.id=e.group_id where e.type='mv' order by e.created_at desc limit 20;` après chaque élargissement de sources.

### 3.11 — Élargissement top-40 : 3 faux positifs trouvés au backfill (résolu 2026-06-15, P0.5)

Le passage de 4 à 44 groupes (canary jennie/bts/&TEAM d'abord) a exposé 3 défauts invisibles sur les 4 groupes MVP :

1. **Gate « Official Video » manquant** (`is-official-mv.ts`). Les solistes au format occidental titrent « JENNIE - like JENNIE (Official Video) » (sans « music »). `detectEventType` acceptait déjà `official video`, mais `isOfficialMvTitle` ne whitelistait que `official music video`/`music video`/`mv` → **Jennie = 0 MV** (les deux gates incohérents). Fix : ajout de `official video` à la whitelist. La BLACKLIST (évaluée avant) garde « Official **Lyric** Video »/« **Performance** Video » rejetés.

2. **« MV Shoot Sketch » ingéré comme MV** (`is-official-mv.ts`). BANGTANTV (@BTS) poste surtout des making-of de tournage titrés « … 'song' MV Shoot Sketch - BTS (방탄소년단) » → 8 dérivés insérés en `mv_kind=main`. Fix : `shoot sketch` ajouté à la BLACKLIST. BANGTANTV tombe alors à 0 (les vrais MV BTS sont sur HYBE LABELS).

3. **Crédit de featuring sur-matché** (`group-match.ts`). « LE SSERAFIM (르세라핌) 'SPAGHETTI (feat. j-hope **of BTS**)' OFFICIAL MV » attribué à **BTS** (le `of BTS` du crédit invité contient `bts`). Fix : `FEATURING_RE` retire les parenthèses `(feat…|ft…|with…|prod…)` avant le `matchesGroup`. On garde la sémantique « mention n'importe où » (un nom hangul entre parenthèses reste pris en compte) — pas de matching par préfixe, qui aurait cassé le cas « 'Magnetic' M/V — first single from ILLIT ».

**Leçon** : tester un scraper sur les 4 mêmes groupes ne suffit pas — chaque nouvelle classe d'artiste (soliste occidental, chaîne behind-the-scenes, collab avec featuring) a son piège. Le **canary sur 3 groupes choisis pour leur risque** (soliste / chaîne sketch / nom court) avant le batch complet a payé. Contrôle d'intégrité post-batch : `select source_url, count(distinct group_id) from events where type='mv' group by 1 having count(distinct group_id) > 1;` doit rester vide (aucune sur-attribution).

### 3.8 — `release`/`concert` déduits d'uploads YouTube (résolu 2026-06-12, P0.1)

**Symptôme** : 92 events `release` et 16 `concert` source youtube_api en prod, dont « LEMONADE Recipe » (short makeup), « 'WDA' Cheering Guide », « 'Drift' (Official Audio) », et des promos de concert datées à la **date d'upload** (« Next Stop is…SINGAPORE 2026.06.13 » stocké au 31/05). 4 « releases » le même jour pour un fan d'aespa ; `notify-comebacks` (qui cible `['mv','release']`) pouvait pousser des notifs sur ce bruit.

**Cause** : `detectEventType` classait en `release`/`concert` sur mots-clés (`album`, `single`, `tour`…), or **un upload YouTube ne porte que sa date de publication — jamais la date d'un event réel**. Toute déduction de release/concert depuis un upload est structurellement fausse.

**Fix** : `scrapeGroup` n'ingère plus QUE `type='mv'` (gate `eventType !== 'mv' → skip`, puis gate strict `isOfficialMvTitle`). Répartition des types par source actée : `release` = kpopofficial (annonces datées), `concert` = suggestions manuelles, `music_show` = source dédiée. Au passage, `kpopofficial.ts` insère désormais `type='release'` (une annonce de comeback est une sortie datée sans vidéo — taxonomie MV=clip / Release=audio du 2026-05-27) au lieu du `'mv'` hérité du rename `comeback→mv`.

**Backfill prod** (exécuté 2026-06-12, backup local avant suppression) :

```sql
-- 135 supprimés (92 release + 16 concert + 27 other legacy, tous youtube_api,
-- zéro rating/comment/like dessus ; event_notifications en ON DELETE CASCADE)
delete from events e using sources s
where s.id = e.source_id and s.type = 'youtube_api'
  and e.type in ('release','concert','other');
-- 6 re-typés (les kpopofficial 'mv' sans mv_kind ni slug → 'release')
update events e set type = 'release' from sources s
where s.id = e.source_id and s.type = 'kpopofficial' and e.type = 'mv';
```

**Méthode de découverte récurrente** : `SELECT s.type, e.type, count(*) FROM events e JOIN sources s ON s.id=e.source_id GROUP BY 1,2;` — toute ligne youtube_api avec un type ≠ `mv`, ou kpopofficial ≠ `release`, signale une régression.

### 3.9 — Doublons cross-chaînes : même MV posté par la chaîne du groupe ET du label (résolu 2026-06-12, P0.2)

**Symptôme** : « ICONIC BY MISTAKE », « Tick-Tack », « Cherish (My Love) », « jellyous » présents **2×** sur `/mvs` et dans « Recent comebacks » (le module le plus visible de l'app), avec des slugs `…-official-mv` et `…-official-mv-2`.

**Cause** : HYBE LABELS reposte les MV ILLIT comme **uploads distincts** (videoId et `source_url` différents), titre identique au préfixe « # » près (`#ILLIT (#아일릿) ‘Tick-Tack’…`). La contrainte unique `(group_id, type, start_at, source_url)` ne protège que du re-scrape de **la même URL** — pas du même contenu via deux chaînes. NB : la dédup par videoId ne servirait à rien (les videoId diffèrent) ; il faut une dédup **sémantique**.

**Fix** : `normalizeMvTitle()` (NFKC + lowercase + strip de tout non-alphanumérique Unicode — le « # » tombe, le hangul reste) + check anti-doublon dans `scrapeGroup` : même titre normalisé à **±14 jours** pour le même groupe → skip (`[yt] skip cross-channel duplicate`). Égalité **stricte**, pas d'inclusion : `'Better Things' MV` (2023-08-18) et `'Better Things' MV (æ-aespa Ver.)` (2023-10-06) sont deux events légitimes. Premier arrivé gagne (l'ordre des sources décide de la chaîne conservée). Tests sur les paires prod réelles dans `youtube.test.ts`.

**Backfill prod** (exécuté 2026-06-12) : 5 lignes supprimées — les 3 reposts `#ILLIT`, le `ICONIC …-official-mv-2`, et le legacy `‘SUGAR HONEY ICE TEA’ M/V OUT NOW` (antérieur au câblage du gate §4.1, qui blackliste « OUT NOW » depuis). Garde : zéro rating/comment/like sur les lignes supprimées. Vérifié après coup : 0 paire restante en DB, 0 slug doublon sur `/mvs` en prod.

**Méthode de découverte récurrente** :

```sql
with mv as (select id, group_id, title, start_at::date as day from events where type='mv')
select a.title, b.title from mv a join mv b
  on a.group_id=b.group_id and a.id<b.id and abs(a.day-b.day)<=14
  and regexp_replace(lower(a.title),'[^a-z0-9가-힣]','','g')
    = regexp_replace(lower(b.title),'[^a-z0-9가-힣]','','g');
```

### 3.12 — kpopofficial : l'artiste migre du `gspb_meta_value` vers `.gspb-dynamic-title-element` (résolu 2026-06-16)

**Symptôme** : couverture comebacks **dégradée** (pas une panne totale). `scrape_log` montrait `matched ~10/run` ; le carrousel « upcoming » de la page mensuelle et les éditions JP n'arrivaient jamais en base. Invisible sans inspection : la grille classique passait encore et le cron restait vert.

**Cause** : kpopofficial (Greenshift/WordPress) a déplacé le nom d'artiste du span `gspb_meta_value` vers l'élément de titre dynamique `.gspb-dynamic-title-element`. Sur ces items, `pickArtist(metas)` ne trouvait plus l'artiste — ou renvoyait une valeur parasite (« 2nd Digital Single », date « … JST ») → `matchGroups` → aucun match → comeback **silencieusement skippé**. Sur la page de juin 2026 : 51 items uniques, dont seulement 6 propres en meta, 10 garblés, 35 carrousel entièrement ratés.

**Fix** : lire l'artiste depuis `.gspb-dynamic-title-element` en priorité, `pickArtist(metas)` en fallback (items legacy / fixtures synthétiques). **Strictement non régressif** (les items propres en meta sont non-conflictuels → résultat identique) et **sans risque de donnée corrompue** : `ingestComebacks` ne crée un event que si `matchGroups` matche l'artiste. Régression verrouillée par une **capture réelle datée** `__fixtures__/kpopofficial-june-2026.html` (testée dans `kpopofficial.test.ts`).

**Méthode de découverte** : c'est en construisant cette fixture réelle (règle « real data over fixtures ») que le parser a révélé 0 sur le carrousel ; croisé avec `scrape_log` (la prod parsait encore la grille) → diagnostic « dégradation, pas panne ». **Vérification post-déploiement** : `matched` doit remonter au prochain run du cron `scrape-comebacks`.

### 3.13 — 202 non-MV en `mv_kind='main'` : durée jamais vérifiée + hashtags de label (résolu 2026-07-03)

**Symptôme** : ~20 % du catalogue MV (202/1017) était du dérivé — teasers, behinds, versions Shorts — dont « Gene » (MV de **UAU** attribué à Dreamcatcher) et des « M/V BTS » ASTRO. Signalé par Rudy comme existentiel.

**Causes (3 trous distincts)** :

1. **Durée jamais récupérée** : `videos.list` demandait `part=snippet,liveStreamingDetails` sans `contentDetails` → un « MV » de 30 s passait tous les gates. ~121 lignes de 14-61 s, dont les **versions Shorts** (59-61 s) postées par les chaînes officielles avec le titre exact du clip — qui en plus **bloquaient l'ingestion du vrai MV** via la dédup par titre ±14 j (§3.9).
2. **Blacklist lacunaire** : `촬영` (tournage), `M/V BTS` (behind-the-scenes — PAS le groupe), `MV Highlight/Sketch`, `Shorts M/V`, `Dance Video (MV ver.)`, `Lip ver.`, `Moment Clip`, `Spoiler`, `MV SOON` manquaient.
3. **Hashtags de label dans le group-match** : « 유아유(UAU) 'GENE' MV … #Dreamcatcher_UAU » matchait Dreamcatcher via le hashtag maison. Fix : hashtags strippés du titre éditorial AVANT le match, avec **repli hashtag strictement égal** au nom (`#ENHYPEN` ✓ — certaines chaînes titrent en hashtag — mais `#Dreamcatcher_UAU` ✗).

**Fix** : gate durée `MIN_MV_DURATION_SEC = 75` (les premieres à venir n'ont pas de durée `P0D` → non gatées, rattrapées au re-scan) ; blacklist étendue (title-only — **ne PAS blacklister la description** : les descriptions de vrais MVs contiennent « Teaser : lien » → faux négatifs massifs) ; `stripHashtags` + repli exact dans `matchesGroup`. Purge via `scripts/audit-mv-catalog.ts` (dry-run puis `--write`, FK en CASCADE). **Piège du script** : le select Supabase est plafonné à 1000 rows → pagination `.range()` obligatoire (17 events non audités au premier run).

**Vérification** : SQL zéro pattern restant + 13 fixtures de titres réels prod dans `is-official-mv.test.ts` / `group-match.test.ts`. Post-purge : 815 MVs propres.

---

## 8. Versions de MV (`mv_kind` + `member_id`)

Système introduit par migration `0010_mv_versions.sql` (PR-B `feat/mv-versions-and-filtering`). Chaque event `type='mv'` est classifié par `mv_kind`. Les autres types ont `mv_kind=NULL` (default).

### Enum `mv_kind`

| Valeur          | Sémantique                              | Exemples de titres                                                                                           |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `main`          | Clip principal officiel                 | `aespa 'Whiplash' Official MV`, `(G)I-DLE 'Klaxon' Official Music Video`                                     |
| `performance`   | Performance / Dance / Choreography ver. | `'Armageddon' MV (Performance Ver.)`, `'Queencard' M/V (Performance Ver.)`                                   |
| `member`        | Version centrée sur un membre           | `ILLIT 'It's Me' Official MV (MOKA ver.)`, `(WONHEE ver.)` — `member_id` renseigné                           |
| `other_version` | English / Remake / sub-unit / etc.      | `'Life's Too Short (English Ver.)' MV`, `'Better Things' MV (æ-aespa Ver.)`, `'(2024 aespa Remake Ver.)' MV` |

### Algorithme de détection

Implémenté dans `src/lib/scrapers/mv-version.ts:detectMvVersion(title, members)` :

1. Cherche dans le titre la **dernière paire de parens flat (non-nested)** contenant `Ver.` ou `ver` (case-sensitive sur le `[Vv]`). Si rien → `main`.
2. Strip `Ver.`/`ver` du contenu pour obtenir le **descripteur**. Vide → `other_version`.
3. Si descripteur ∈ {`performance`, `dance`, `choreography`, `choreo`} (case-insensitive) → `performance`.
4. Sinon, compare le descripteur normalisé (Unicode-aware, lowercase, strip non-alphanum) à chaque `stage_name` du groupe par **égalité stricte**. Match → `member` + `memberId`.
5. Sinon → `other_version`.

L'égalité stricte (pas `includes`) évite que "moka choreography ver." matche Moka quand c'est en réalité une Performance. L'ordre des règles (Performance d'abord) couvre les ambiguïtés.

### Matrice de visibilité par surface

Configurée dans `src/lib/events/queries.ts` :

| Surface                                                                     | Filtre `mv_kind`                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `/` (Upcoming), `/calendar`, `/my`, `/mvs` global, sidebar Recent comebacks | `main` uniquement (les non-MV passent via `OR mv_kind IS NULL`) |
| `/groups/[slug]` section MVs                                                | `main` + `performance` (versions de groupe utiles)              |
| `/artists/[slug]` (PR-C futur) via `getMemberMvs(memberId)`                 | tout MV où `member_id` = membre courant                         |

### Invariant DB

CHECK constraint `events_member_id_implies_member_kind` : `member_id IS NULL OR mv_kind = 'member'`. Empêche d'INSERT un member_id avec une autre kind. Le cas inverse (kind='member' + member_id=NULL) reste autorisé pour gérer la `ON DELETE SET NULL` quand un membre est retiré du roster.

### Audit récurrent

```sql
-- Distribution des kinds (sanity check après chaque scrape majeur)
SELECT mv_kind, count(*) FROM events WHERE type='mv' GROUP BY mv_kind ORDER BY count(*) DESC;

-- MVs récemment scrapés et leur classification
SELECT slug, title, mv_kind, member_id FROM events
WHERE type='mv' AND created_at > now() - interval '1 day'
ORDER BY created_at DESC;

-- Versions qui sont sorties en 'other_version' — auditer périodiquement pour
-- voir si des markers (ex: "Bilingual Ver.") méritent d'être ajoutés à la
-- detection comme un nouveau kind.
SELECT title FROM events
WHERE type='mv' AND mv_kind='other_version'
ORDER BY start_at DESC LIMIT 20;
```

---

## 4. Découverte de chaînes pour nouveaux artistes

> **Fait (P0.5, 2026-06-15)** : couverture étendue des 4 groupes MVP à **44 groupes** (top ~40 actifs). Discovery menée par workflow multi-agents **oembed** (la méthode ci-dessous, scalée) : chaque MV récent réel est oembed-vérifié pour identifier la **vraie chaîne hôte** (officielle + umbrella label). Mapping vérifié persisté dans **`scripts/youtube-channels.json`** (commité — la sortie d'une discovery ne doit jamais rester volatile), seedé via **`scripts/seed-youtube-sources.ts`** (idempotent), backfillé via **`scripts/backfill-youtube.ts`**. Prérequis schéma : `UNIQUE(url, group_id)` (migration 0033) pour réutiliser une chaîne umbrella sur plusieurs groupes. Résultat : ~340 MV ingérés, 0 sur-attribution (aucun MV sous 2 groupes). Pièges trouvés et corrigés en route : gate « Official Video » (§3.11), « shoot sketch » (§3.11), crédit featuring sur-matché (§3.11).

Quand on étendra le roster, **ne pas refaire l'erreur §3.3** : ne jamais ajouter une chaîne sans la vérifier.

### Méthode de vérification rapide (validée 2026-05-28)

Sans clé API, sans dépendance, marche pour toute candidate :

1. **Identifier un MV connu** de l'artiste sur YouTube (ex: chercher "{artist} {known song} Official Music Video" via Google ou YT search). Récupérer le `videoId` (11 chars dans `youtube.com/watch?v=<id>`).
2. **oembed query** (public, sans auth) :
   ```
   https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<videoId>&format=json
   ```
   Retourne `{ title, author_name, author_url, ... }`. `author_url` = la **vraie chaîne** qui a uploadé ce MV.
3. **Confirmation visuelle** via [Jina reader proxy](https://r.jina.ai/) (public, gratuit, contourne le consent YT et les pages JS-only) :
   ```
   https://r.jina.ai/<channel URL>
   ```
   Retourne le contenu rendu de la page chaîne : liste de vidéos visibles + nom de chaîne + handle.

Cette méthode a évité l'erreur du PR-B initial où on avait choisi `@theunitedcube` (umbrella CUBE Entertainment) au lieu de `@official_i_dle` (channel ID `UCritGVo7pLJLUS8wEu32vow`) pour les MVs i-dle. Cf. [[reference-yt-channel-discovery]] memory.

### Stratégie de discovery proactive (à scripter dans un futur `scripts/discover-yt-channels.ts`)

1. **Requête YouTube search globale** : `search.list?type=video&q="${artist} Official Music Video"&maxResults=20` (sans `channelId`).
2. **Histogramme des `channelId`** sur les 20 résultats → la chaîne qui revient le plus souvent est probablement la chaîne hôte des MVs.
3. **Validation** : pour chaque chaîne candidate top-3, faire `search.list?channelId=X&q="${artist}"&maxResults=10` et compter combien de résultats. Une chaîne avec ≥3 résultats `q="${artist}"` est très probablement la bonne.
4. **Output humain** : afficher les 3 candidates avec name, handle, count, et liens directs vers la chaîne (`youtube.com/channel/<id>`). L'opérateur (Rudy) confirme et le script fait l'INSERT en DB.

### Fallback Google search

Pour artistes très obscurs où YouTube search ranke mal : Google `"${artist} Official Music Video" site:youtube.com`. Récupérer un videoId. oembed pour identifier la chaîne. Vérifier par recherche `q="${artist}"` sur cette chaîne.

### Sources tierces (autorité)

- **MusicBrainz** : a souvent un lien YouTube structuré pour les artistes mainstream. Pas garanti pour le K-pop.
- **Wikipedia** : section "External links" ou infobox.
- **kpopnet.json** ([CC0 dataset bootstrap](https://github.com/kpopnet/kpopnet.json)) : peut contenir des liens chaîne.

---

## 5. Diagnostic — SQL queries de référence

À garder sous la main pour inspecter l'état :

```sql
-- Distribution des types
SELECT type, count(*) AS n FROM events GROUP BY type ORDER BY n DESC;

-- Sources YT actives + dernier scrape
SELECT s.name, g.slug AS group_slug, s.url, s.last_scraped_at
FROM sources s LEFT JOIN groups g ON g.id = s.group_id
WHERE s.type = 'youtube_api'
ORDER BY g.slug, s.name;

-- MVs réels en prod (post-fix derivatives)
SELECT slug, title, source_url
FROM events
WHERE type = 'mv'
ORDER BY start_at DESC
LIMIT 20;

-- Events ingérés sur la dernière fenêtre (utile post-scrape)
SELECT e.type, e.title, g.slug AS group_slug, s.name AS source_name
FROM events e
JOIN groups g ON g.id = e.group_id
LEFT JOIN sources s ON s.id = e.source_id
WHERE e.created_at > now() - interval '15 minutes'
ORDER BY e.created_at DESC;

-- Détection des entités HTML résiduelles (devrait toujours renvoyer 0)
SELECT count(*) FROM events
WHERE title LIKE '%&#%' OR title LIKE '%&amp;%'
   OR description LIKE '%&#%' OR description LIKE '%&amp;%';
```

---

## 6. Triggers et cron

- **Crons Vercel** (cf. `vercel.json`, tous protégés par `Authorization: Bearer $CRON_SECRET`, tous 1×/jour max — limite Hobby **par cron**) : `/api/cron/scrape-youtube` (03:00 UTC), `/api/cron/scrape-comebacks` (kpopofficial **+ Wikipedia**, 03:30 — cf. §10), `/api/cron/scrape-music-shows` (13:00), plus 3 crons non-scraping (`send-digest` 08:00, `notify-comebacks` 09:00, `refresh-images` lundi 04:00).
- **Observabilité (P0.3, 2026-06-12)** : chaque run de scraping écrit une ligne dans `scrape_log` (`source`, `status` ok/partial/error, `error_msg`, `details` jsonb avec les counts) via `src/lib/scrapers/scrape-log.ts`. Contrat d'échec : **HTTP 500 quand le run est inexploitable** (0 source/page/lineup OK) pour que le dashboard Vercel Crons le signale ; `partial` (200) = sources en échec partiel, fallbacks utilisés, ou « pages 200 mais 0 entrée parsée » (signature d'un changement de markup). `last_scraped_at` n'est rafraîchi qu'en cas de récolte réelle.
- **Diagnostic rapide** : `select source, status, error_msg, started_at from scrape_log order by started_at desc limit 10;`
- **Trigger manuel** :

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://kstage.vercel.app/api/cron/scrape-youtube
  ```

  Réponse JSON `{ok:true, results:{<source_id>:{inserted,skipped}|{error}}}`.

- **Boucle dev local** : pas d'endpoint, lancer `scrapeGroup` directement depuis un script ad-hoc avec un client `service_role`.

---

## 7. À faire — sujets connus non traités

Listés ici pour ne pas oublier au prochain run :

> Les items data/observabilité sont désormais tracés dans `docs/BACKLOG.md` P0 (source de vérité). Rappel des sujets, état audit 2026-06-12 :

- [x] **Observabilité** (BACKLOG P0.3) : ✅ fait 2026-06-12 (cf. §6) — statuts ok/partial/error + `scrape_log` alimentée (colonne `details` jsonb, migration 0031) + 500 sur run inexploitable + `last_scraped_at` gaté sur récolte réelle.
- [ ] **Dédup cross-chaînes par videoId** (BACKLOG P0.2) : la clé unique inclut `source_url` → même MV sur 2 chaînes = 2 lignes (~7 paires en prod).
- [x] **Cleanup classification** (BACKLOG P0.1) : ✅ fait 2026-06-12 (cf. §3.8) — gate mv-only dans le scraper YouTube, 135 lignes de bruit purgées en prod.
- [x] **kpopofficial `type='mv'` sans `mv_kind`** : ✅ résolu 2026-06-12 — kpopofficial insère désormais `type='release'` (cf. §3.8) ; les 6 lignes existantes re-typées (ce qui résout aussi les 6 « mv sans slug »).
- [x] **Réécriture quota** (BACKLOG P0.4) : ✅ fait 2026-06-13 (cf. §2) — pipeline `playlistItems.list`, ~3-4 units/source (vérifié : 8 sources = 27 units vs 1 600 avant), premieres programmées via `videos.list` (`pickStartAt`), `QuotaExceededError` géré, `subscriber_count` persisté (migration 0032), idempotence batchée.
- [x] **Élargissement couverture** (BACKLOG P0.5) : ✅ fait 2026-06-15 (cf. §4) — 4 → 44 groupes via discovery oembed (workflow), `scripts/youtube-channels.json` + `seed-youtube-sources.ts` + `backfill-youtube.ts`, migration 0033 (`UNIQUE(url, group_id)`), ~340 MV ingérés. 3 pièges corrigés (§3.11).
- [ ] **Limite uploads-playlist incomplète** (§2) : clips phares de certaines chaînes perso (ex. Rosé/APT) absents de la playlist `uploads` → non récupérables par `playlistItems`. Fallback `search.list?channelId=…&q=…` (100 units) à implémenter si on veut combler ces cas.
- [ ] **Jung Kook / Jimin** : MV uniquement sur HYBE LABELS, au-delà des 600 uploads récents → backfill profond ponctuel fait (maxPages=60) ; le cron quotidien (maxPages=2) ne capte que leurs futurs MV en tête de playlist.
- [x] Pagination historique : ✅ absorbée par P0.4 — `maxPages` élevé au backfill couvre les artistes seniors (1 unit/50 vidéos).
- [ ] Décider si on garde les chaînes d'agence après N runs prouvant qu'elles n'ajoutent rien (probable pour HYBE LABELS, YG si la Pass B sur chaîne officielle suffit).

---

## 9. Music shows hebdomadaires (livré 2026-05-29)

Étape 7 du MVP enfin clos. Architecture multi-source avec primary `liveshowupdatess.carrd.co` (fan-aggregator) + 6 fallbacks officiels par broadcaster.

### Créneaux KST verrouillés

| Show          | Day | Time KST | Broadcaster |
| ------------- | --- | -------- | ----------- |
| The Show      | Tue | 18:00    | SBS Fun-E   |
| Show Champion | Wed | 17:00    | MBC M       |
| M Countdown   | Thu | 18:00    | Mnet        |
| Music Bank    | Fri | 17:00    | KBS 2TV     |
| Music Core    | Sat | 15:15    | MBC         |
| Inkigayo      | Sun | 15:25    | SBS         |

Cf. `src/lib/scrapers/music-shows/types.ts:SHOW_DESCRIPTORS`.

### Architecture aggregator

`src/lib/scrapers/music-shows/aggregator.ts:aggregateLineups()` :

1. Tente `liveShowUpdatesSource` (primary) — 1 fetch couvre les 6 shows.
2. Pour chaque show NON couvert par primary, tente le fallback officiel.
3. Catch erreurs par source — un fallback qui échoue n'arrête pas les autres.

Renvoie `AggregateResult { lineups, primaryOk, fallbacksUsed, errors }`.

### Sources scrapables validées (Jina reader proxy)

| Show                | Source URL                                     | Pattern                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **All 6 (primary)** | `liveshowupdatess.carrd.co`                    | Sections `## ✧*̥˚ {SHOW} *̥˚✧` + `Episode: N` + lineup `Artist1 / Artist2 / …`                                                                                                                                                 |
| The Show            | `programs.sbs.co.kr/fune/theshow/boards/64513` | 2-level scrape (board → post `# The Show … Stage #` + `**ARTIST [SONG]**`)                                                                                                                                                   |
| Show Champion       | `m.imbc.com/program/1003864100000100000`       | Bloc `**NNN**회 Show Champion (쇼 챔피언) - HEADLINERS 등 [FULL_LIST] YYYY.MM.DD` ; parser anchored sur `**NNN**회` (le titre apparaît aussi dans l'alt-text image) ; split sur `등` → liste complète ou fallback headliners |
| M Countdown         | `mnetplus.world/.../lineup`                    | Blocs `![Image N]` + ligne artiste séquentiels                                                                                                                                                                               |
| Music Bank          | `program.kbs.co.kr/.../musicbank`              | Marker `<<뮤직뱅크 X월 Y일 출연자>>` + comma list ; date `오늘 방송 YYYY.MM.DD`                                                                                                                                              |
| Music Core          | `playvod.imbc.com/Templete/PreView`            | Italique `_artist . artist . …_` + `[NNN회]YYYY-MM-DD`                                                                                                                                                                       |
| Inkigayo            | `programs.sbs.co.kr/enter/gayo/boards/54772`   | 2-level scrape (board → post `# NNNN 회 인기가요 출연자 #` + comma list)                                                                                                                                                     |

Helper partagé pour les 2-level SBS : `src/lib/scrapers/music-shows/sources/sbs-board.ts`.

### Cron

Vercel cron `/api/cron/scrape-music-shows` daily 13:00 UTC = 22:00 KST. Catche les lineups posted night-before (weekday) + 2-3 jours en avance (weekend).

Idempotence via unique constraint `events (group_id, type, start_at, source_url)`. `source_url` = URL primary carrd même quand un fallback a fourni les données — la stabilité de la clé prime sur la traçabilité.

### Stage links — enrichissement YouTube des events music_show (livré 2026-07-03)

Phase 2 du cron `scrape-music-shows` : après l'upsert des lineups, `src/lib/scrapers/music-shows/stage-links.ts:enrichStageLinks()` relie chaque event music_show à la **vidéo YouTube du stage** (performance individuelle du groupe) et met à jour `source_url` + `image_url`. Décision produit : la bannière d'un music show clique vers le stage, jamais vers le carrd.

**Chaînes officielles vérifiées** (`STAGE_CHANNELS`, handles confirmés via API `forHandle` — ne jamais deviner) :

| Show          | Chaîne YouTube |
| ------------- | -------------- |
| Music Bank    | `@KBSKpop`     |
| Music Core    | `@MBCkpop`     |
| Inkigayo      | `@sbskpop`     |
| M Countdown   | `@Mnet`        |
| Show Champion | `@ALLTHEKPOP`  |
| The Show      | `@thekpop`     |

**Pipeline** :

1. **Events candidats** : music_show des 10 derniers jours dont `source_url` est NULL ou non-YouTube. ⚠️ Piège SQL : `NOT ILIKE` exclut les NULL → `.or('source_url.is.null,source_url.not.ilike.%youtube.com%')`.
2. **Uploads récents** de la chaîne du show (pipeline playlistItems partagé avec le scraper MV).
3. **Matching** : marker du show dans le titre (`STAGE_TITLE_MARKERS`) + `matchesGroup()` (strip hashtags + fallback hashtag-exact-normalisé) + fenêtre `[H−12h, H+4j]` autour du créneau de diffusion.
4. **Scoring** (`rankStageCandidates`, seuil `MIN_STAGE_SCORE = 1`) : `방송`/`EP`/`무대` +2, pattern « Song - Group » +1, **multi-artiste −3** (segments variety type « M-Z »), `#shorts` −5.
5. **Validation durée** : `videos.list` (contentDetails) → **≥ 60 s** obligatoire. Élimine les Shorts/clips caption qui passent le scoring.

**Faux positifs traversés** (chacun devenu un test unitaire, 8 tests dans `stage-links.test.ts`) : run 1 = Shorts « caption clip » Mnet (fix : scoring + durée) ; run 2 = segment variety multi-artistes « M-Z » (fix : pénalité multi-artiste). Premier run réel propre : **24/40 events liés**, tous vérifiés via oembed.

**Quota** : ~16 unités YouTube API par run (6 chaînes × ~2 appels + videos.list batché) — négligeable vs les 10 000/jour.

### Limite de couverture temporelle — semaine courante seulement (vérifié 2026-06-15, P0.8)

**Constat (BACKLOG P0.8)** : la couverture music-shows ne dépasse jamais la **semaine de diffusion en cours** (~ jusqu'à 7 j). Ce n'est **pas un bug parser** — c'est structurel aux sources :

- Le carrd ET les broadcasters officiels ne publient les **lineups** que tardivement (la veille en semaine, 2-3 j avant le week-end). Aucune source ne liste plusieurs semaines à l'avance.
- Entre deux cycles, le carrd affiche encore la semaine **passée** avec des lineups placeholder « ~ » (vérifié : sections datées 06/02→06/11 le 15/06, lineups vides). `r.jina.ai` peut en plus servir une version **cachée/périmée** — toujours croiser avec l'état prod, pas la fetch Jina seule.
- État prod au 15/06 : **6 events music_show futurs**, dernier à +4 j (19/06) = le reste de la semaine. Conforme à l'attente.

**Impact « ta semaine k-pop »** : la feature est satisfaite pour la semaine en cours, jamais au-delà. Le parser capte déjà tout ce que les sources exposent — rien à corriger côté parsing.

**Piste d'amélioration (non implémentée, décision produit requise)** : générer des **slots récurrents synthétiques** à partir du planning hebdo fixe (table §9 : show → jour + heure KST), comme les anniversaires, pour que le calendrier affiche toujours les 6 shows de la semaine — enrichis du lineup quand une source le poste. Nécessite une dédup vs les events scrapés (même `start_at`/épisode) et tranche un choix produit (afficher un show sans lineup encore connu). Cf. BACKLOG.

### Méthodologie de re-vérification de sources

Quand une source change ou tombe :

1. Capturer une fixture fraîche via `curl -s "https://r.jina.ai/<url>" -o __fixtures__/<source>-<date>.txt`.
2. Inspecter le format (grep + sed).
3. Adapter le parser ; vérifier que tous les tests fixture passent avant push.

Cf. [[reference-jina-reader-universal-proxy]] memory.

### Sources écartées

- `kpopofficial.com` : pas de section music shows
- `kpopping.com/calendar/music-shows` : agenda events, pas de lineups
- `kprofiles.com` : HTTP 451
- `reddit.com/r/kpop/wiki/...` : 403 anti-bot
- `youtube.com/@SBSKPOP/posts` : marketing seulement
- `youtube.com/@thekpop/posts` : posts "Ep.X LINE UP" sans détail
- Twitter `@MnetMcountdown` etc. : verbatim accessible mais X API payant

---

## 10. Comebacks annoncés — 2 sources, SPOF cassé (P0.7, 2026-06-15)

Le **futur** du calendrier (releases datées annoncées) reposait à 100 % sur `kpopofficial.com` — un seul site, un seul point de défaillance. On a ajouté une **2ᵉ source au failure mode différent** : la page Wikipedia EN « {year} in South Korean music ».

### Architecture

- Le cron `/api/cron/scrape-comebacks` lance **les deux** sources, échecs indépendants (une qui tombe n'empêche pas l'autre), chacune avec sa ligne `scrape_log`. 500 (= cron rouge dans Vercel) **uniquement si la primaire kpopofficial est inexploitable** ; un échec Wikipedia est tracé sans casser le run.
- Cœur partagé `src/lib/scrapers/comeback-ingest.ts` : `matchGroups` (réutilisé) + `ingestComebacks` (insert idempotent `type='release'`). kpopofficial et Wikipedia produisent tous deux des `ParsedComeback[]` et passent par lui.
- **Dédup cross-source** (`ingestComebacks` opt `crossSourceDedupeDays: 3`) : avant d'insérer, on skippe s'il existe déjà une `release` pour ce groupe à ±3 j provenant d'une **autre** `source_id`. → la 2ᵉ source ne **comble que les trous** (kpopofficial mort, ou horizon au-delà de sa fenêtre 2 mois), jamais ne duplique. Le filtre porte sur `source_id`, donc une même source garde ses entrées multiples.

### Source Wikipedia (`src/lib/scrapers/wikipedia-releases.ts`)

- **Wikitext brut** via `?action=raw` (pas de HTML rendu, pas d'anti-bot). Structure stable : sous-sections `====Mois====` → wikitable `Date | Album | Artist(s) | Ref`. Parser tolérant : carry du jour sur `rowspan`, alias `[[Cible|Alias]]`, `{{ill|Nom|…}}`, titres `''italic''`, section `===TBA===` (dates inconnues) ignorée, table « Awards » discriminée par son header.
- **Futur seulement** : on n'insère que `start_at >= now` (le passé 2026 est couvert par le scraper YouTube). `source_url` synthétique unique `…2026_in_South_Korean_music#YYYY-MM-DD_<album-slug>` (clic → la page).
- Tests : `wikipedia-releases.test.ts` contre une **fixture wikitext réelle** (`__fixtures__/wikipedia-2026-in-skm.txt`).
- One-shot manuel : `scripts/scrape-wikipedia-once.ts`.
- **Vérifié 2026-06-15** : parsed=186, future=13, matched=4, inserted=0 (les 4 matches déjà couverts par kpopofficial → dédup OK, 0 doublon). Le mécanisme est live ; la valeur se réalise quand kpopofficial rate/meurt.

### Limites assumées

- Couvre albums/EP, pas chaque single/MV. Ne prend que le **1ᵉʳ artiste** d'une ligne multi-artistes (corroboration, pas exhaustivité). Rollover d'année : le scraper cible automatiquement la page de l'année courante (`now.getUTCFullYear()`).

### Candidats écartés (scout 2026-06-15)

- **Reddit r/kpop** (wiki/JSON/threads) : 403 anti-bot partout, même via Jina → `dead`.
- **kpopschedule.com/upcoming** : vivant + structuré mais **JS-only** (nécessite Jina/headless) et faible volume (6 entrées) → `viable` mais non retenu (dépendance lourde pour peu de gain ; à reconsidérer si besoin d'une 3ᵉ source).
- **MusicBrainz** : surtout des releases _passées_, peu de futur annoncé fiable.
