# SCRAPING.md — Référence opérationnelle du scraping KStage

Document vivant. Mis à jour à chaque pièce nouvelle découverte ou résolue. Si tu travailles sur un fix scraper, **lis ce fichier en premier** : tous les pièges qu'on a déjà traversés sont listés ici pour éviter de re-galérer.

---

## 1. Architecture des sources

Table `sources` (cf. `supabase/migrations/0001_init.sql` + `0003_scraping.sql`) :

| Colonne           | Description                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| `id`              | uuid PK                                                                               |
| `name`            | label humain (ex. "aespa SMTOWN", "BABYMONSTER YouTube")                              |
| `url`             | URL canonique de la chaîne YT (`https://www.youtube.com/@handle` ou `/channel/UC...`) |
| `type`            | `youtube_api` \| `kpopofficial` \| `community`                                        |
| `group_id`        | FK vers `groups.id` (null pour sources groupe-agnostiques comme kpopofficial)         |
| `last_scraped_at` | timestamptz du dernier run réussi                                                     |

**Convention** : pour les sources YT, on a **deux catégories** par groupe :

- **Chaîne officielle** (ex. `@aespa`, `@official_i_dle`) — porte les MVs récents, vlogs, performances, lives.
- **Chaîne d'agence** (ex. `@SMTOWN`, `@YGEntertainment`, `@HYBELABELS`, `@theunitedcube`) — peut porter des MVs (notamment historiques pour aespa via SMTOWN, NCT, SHINee), des collabs, des contenus exclusifs.

**Décision** : on garde TOUJOURS les deux (officielle + agence) même si une des deux ne ramène rien actuellement. _Future-proof_ : on ne sait pas ce qu'on voudra ingérer plus tard. La 2-pass scraping (voir §2) filtre proprement les contenus non pertinents.

---

## 2. Stratégie de scraping (2-pass)

Le scraper (`src/lib/scrapers/youtube.ts:scrapeGroup`) fait **deux appels** à `youtube/v3/search.list` par source, dont les résultats sont concaténés et dédupliqués par `videoId` :

### Pass A — `order=date&maxResults=50`

Récupère les **50 uploads les plus récents** de la chaîne, tous types confondus. Utile pour capter au fil de l'eau les nouveaux events (lives, anniversaries, music shows, vraiment-récents MVs).

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

### 3.5 — Filtre nom de groupe vs variantes Hangul/typographiques (résolu 2026-05-28)

**Symptôme** : MVs i-dle dont le titre est en hangul (`(여자)아이들 'Klaxon' Official Music Video`) ne sont pas reconnus comme "i-dle".

**Cause** : `matchesGroup` normalise avant comparaison (`normalize(text).includes(normalize(groupName))`). `normalize("i-dle") = "idle"`. `normalize("(여자)아이들 (G)I-DLE 'Klaxon' MV") = "여자아이들gidle..."` → contient `"idle"` à partir de la position 1 dans `"gidle"` → **match**.

**Note** : `normalize` est Unicode-aware (`[^\p{L}\p{N}]+/gu`) pour garder hangul/kana, contrairement à la version ASCII-only de `kpopofficial.ts`. Les deux ne sont pas interchangeables.

---

## 4. Découverte de chaînes pour nouveaux artistes (futur)

Quand on étendra le roster au-delà des 4 groupes MVP, **ne pas refaire l'erreur §3.3** : ne jamais ajouter une chaîne sans la vérifier.

### Stratégie (à scripter dans un futur `scripts/discover-yt-channels.ts`)

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

- **Cron Vercel** : `/api/cron/scrape-youtube` (cf. `vercel.json`) — protégé par `Authorization: Bearer $CRON_SECRET`.
- **Trigger manuel** :

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://kstage.vercel.app/api/cron/scrape-youtube
  ```

  Réponse JSON `{ok:true, results:{<source_id>:{inserted,skipped}|{error}}}`.

- **Boucle dev local** : pas d'endpoint, lancer `scrapeGroup` directement depuis un script ad-hoc avec un client `service_role`.

---

## 7. À faire — sujets connus non traités

Listés ici pour ne pas oublier au prochain run :

- [ ] Script `scripts/discover-yt-channels.ts` (§4) pour onboarding artistes.
- [ ] Cleanup data : reclasser les ~16 lignes "Behind/Teaser/Performance Video" actuellement en `'release'` qui devraient être `'other'` (post-fix §3.2).
- [ ] Pagination Pass B via `pageToken` pour les artistes seniors (BTS, EXO) qui ont >50 MVs historiques.
- [ ] Quota tracking / retry / backoff sur erreurs API.
- [ ] Décider si on garde les chaînes d'agence après N runs prouvant qu'elles n'ajoutent rien (probable pour HYBE LABELS, YG si la Pass B sur chaîne officielle suffit).
