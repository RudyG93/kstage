# SCRAPING.md — Référence opérationnelle du scraping KStage

Document vivant. Mis à jour à chaque pièce nouvelle découverte ou résolue. Si tu travailles sur un fix scraper, **lis ce fichier en premier** : tous les pièges qu'on a déjà traversés sont listés ici pour éviter de re-galérer.

---

## 1. Architecture des sources

Table `sources` (cf. `supabase/migrations/0001_init.sql` + `0003_scraping.sql`) :

| Colonne           | Description                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | uuid PK                                                                                                                                                                                                                                           |
| `name`            | label humain (ex. "aespa SMTOWN", "BABYMONSTER YouTube")                                                                                                                                                                                          |
| `url`             | URL canonique de la chaîne YT (`https://www.youtube.com/@handle` ou `/channel/UC...`)                                                                                                                                                             |
| `type`            | `youtube_api` \| `kpopofficial` \| `music_shows` \| `community`                                                                                                                                                                                   |
| `group_id`        | FK vers `groups.id` (null pour sources groupe-agnostiques comme kpopofficial)                                                                                                                                                                     |
| `last_scraped_at` | timestamptz du dernier run **qui n'a pas throw** — ⚠️ mis à jour même si 0 page fetchée/0 entrée parsée (audit 2026-06-12) ; ne pas s'y fier pour diagnostiquer une source morte tant que le chantier observabilité (BACKLOG P0.3) n'est pas fait |

**Convention** : pour les sources YT, on a **deux catégories** par groupe :

- **Chaîne officielle** (ex. `@aespa`, `@official_i_dle`) — porte les MVs récents, vlogs, performances, lives.
- **Chaîne d'agence** (ex. `@SMTOWN`, `@YGEntertainment`, `@HYBELABELS`, `@theunitedcube`) — peut porter des MVs (notamment historiques pour aespa via SMTOWN, NCT, SHINee), des collabs, des contenus exclusifs.

**Décision** : on garde TOUJOURS les deux (officielle + agence) même si une des deux ne ramène rien actuellement. _Future-proof_ : on ne sait pas ce qu'on voudra ingérer plus tard. La 2-pass scraping (voir §2) filtre proprement les contenus non pertinents.

---

## 2. Stratégie de scraping (2-pass)

Le scraper (`src/lib/scrapers/youtube.ts:scrapeGroup`) fait **deux appels** à `youtube/v3/search.list` par source, dont les résultats sont concaténés et dédupliqués par `videoId` :

### Pass A — `order=date&maxResults=50`

Récupère les **50 uploads les plus récents** de la chaîne, tous types confondus. Utile pour capter au fil de l'eau les MVs qui viennent de sortir (la Pass B par pertinence peut mettre quelques jours à les remonter). Depuis P0.1 (§3.8), seuls les `mv` sont ingérés — le reste est skippé.

### Pass B — `q="${groupName} Music Video"&maxResults=50`

Récupère les **50 résultats les plus pertinents** pour la requête "${groupName} Music Video" **sur tout l'historique** de la chaîne. Résout le piège §3.4 (fenêtre order=date trop étroite sur chaînes à fort débit). Skip si `groupName` est null.

### Pourquoi 2 passes plutôt qu'1 plus large ?

- Pass A reste indispensable pour les types non-MV (music_show, anniversary…) qui n'ont pas de mot-clé fiable.
- Pass B reste indispensable pour les MVs anciens car `order=date` ne descend pas au-delà des 50 derniers uploads (pagination via `pageToken` mais coût quota croissant).

### Quota

`search.list` coûte **100 units / call**, indépendamment de `maxResults` (1-50) ou de la présence d'un `q=`. Donc 2 passes = 200 units/source/run. 8 sources actives = 1600 units/run. Free tier YouTube Data API = 10 000 units/jour → marge ×6 pour 1 run/jour, ×3 pour 2 runs/jour.

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

## 4. Découverte de chaînes pour nouveaux artistes (futur)

Quand on étendra le roster au-delà des 4 groupes MVP, **ne pas refaire l'erreur §3.3** : ne jamais ajouter une chaîne sans la vérifier.

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

- **Crons Vercel** (cf. `vercel.json`, tous protégés par `Authorization: Bearer $CRON_SECRET`, tous 1×/jour max — limite Hobby **par cron**) : `/api/cron/scrape-youtube` (03:00 UTC), `/api/cron/scrape-comebacks` (kpopofficial, 03:30), `/api/cron/scrape-music-shows` (13:00), plus 3 crons non-scraping (`send-digest` 08:00, `notify-comebacks` 09:00, `refresh-images` lundi 04:00).
- ⚠️ **Échecs silencieux** (audit 2026-06-12) : les 3 routes de scraping renvoient HTTP 200 `{ok:true}` même en échec total, et `scrape_log` n'est jamais alimentée. Vercel ne signale un cron qu'en non-2xx → un scraper mort est invisible. Chantier BACKLOG P0.3.
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

- [ ] **Observabilité** (BACKLOG P0.3) : contrat d'échec 500, écrire dans `scrape_log` (0 ligne aujourd'hui), `last_scraped_at` conditionné au succès.
- [ ] **Dédup cross-chaînes par videoId** (BACKLOG P0.2) : la clé unique inclut `source_url` → même MV sur 2 chaînes = 2 lignes (~7 paires en prod).
- [x] **Cleanup classification** (BACKLOG P0.1) : ✅ fait 2026-06-12 (cf. §3.8) — gate mv-only dans le scraper YouTube, 135 lignes de bruit purgées en prod.
- [x] **kpopofficial `type='mv'` sans `mv_kind`** : ✅ résolu 2026-06-12 — kpopofficial insère désormais `type='release'` (cf. §3.8) ; les 6 lignes existantes re-typées (ce qui résout aussi les 6 « mv sans slug »).
- [ ] **Réécriture quota** (BACKLOG P0.4) : `playlistItems.list` (1 unit/chaîne) au lieu de 2× `search.list` (200 units/source) — prérequis de tout élargissement (à 173 groupes l'archi actuelle = 3,5× le quota free). + quota tracking / retry / backoff + premieres programmées (`liveBroadcastContent=upcoming`).
- [ ] Script `scripts/discover-yt-channels.ts` (§4) pour onboarding artistes (BACKLOG P0.5).
- [ ] Pagination Pass B via `pageToken` pour les artistes seniors (BTS, EXO) qui ont >50 MVs historiques — probablement absorbé par la réécriture `playlistItems.list`.
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
