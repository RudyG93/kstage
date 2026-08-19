/**
 * Helper partagé entre les scrapers SBS Inkigayo + The Show.
 * Les deux shows ont une page "board" identique (tableau de posts avec colonnes
 * 번호 / 제목 / 글쓴이 / 등록일 / 조회수 / 좋아요) et un URL pattern de post
 * `.../board/{BOARD_ID}?cmd=view&page=1&board_no={POST_ID}`.
 *
 * Stratégie :
 *   1. Fetch board → extraire la 1ʳᵉ row non-pub non-notice
 *   2. Du titre, extraire l'épisode (NNN회) + le mois/jour (M월 D일)
 *   3. De la date d'enregistrement (YY-MM-DD), inférer l'année du broadcast
 */

// Le titre peut contenir des `]` (cas Inkigayo : `[[1312회] 5월 31일 …](url)`)
// → on utilise une greedy match jusqu'au `](` final via le pattern `.+?\]\(`.
const POST_DATE_RE =
  /\|\s*(\d+)\s*\|\s*\[(.+?)\]\((https?:[^)]+)\)\s*\|\s*[^|]+\s*\|\s*(\d{2})-(\d{2})-(\d{2})\s*\|/

export interface BoardPostMeta {
  episodeNumber: number | null
  postUrl: string
  postYear: number // 2-digit year converti en 4-digit (20YY)
  monthDay: { month: number; day: number } | null
  postedYmd: { year: number; month: number; day: number }
}

/**
 * Parse le markdown brut d'une page board SBS (Jina-rendered) et renvoie la
 * meta du post le plus récent (= 1ʳᵉ row non-pub non-notice).
 */
export function parseBoardLatestPost(markdown: string): BoardPostMeta | null {
  const lines = markdown.split('\n')
  for (const line of lines) {
    // Skip ad/notice rows (no | NNN | format avec post number).
    if (!POST_DATE_RE.test(line)) continue
    const m = line.match(POST_DATE_RE)
    if (!m) continue
    const title = m[2]
    const postUrl = m[3]
    const yy = Number(m[4])
    const mm = Number(m[5])
    const dd = Number(m[6])
    const postYear = 2000 + yy

    // Extract episode + month/day depuis le titre.
    // Formats observés :
    //   "[1312회] 5월 31일 인기가요 출연진"  (Inkigayo)
    //   "<393회> 11월 11일 THE SHOW 출연진"  (The Show)
    //   "<381회> 7월1일 THE SHOW 출연진"     (variante : pas d'espace après 7월)
    const titleMatch = title.match(/[[<](\d+)회[\]>]\s*(\d+)월\s*(\d+)일/)
    let episodeNumber: number | null = null
    let monthDay: { month: number; day: number } | null = null
    if (titleMatch) {
      episodeNumber = Number(titleMatch[1])
      monthDay = { month: Number(titleMatch[2]), day: Number(titleMatch[3]) }
    }

    return {
      episodeNumber,
      postUrl,
      postYear,
      monthDay,
      postedYmd: { year: 2000 + yy, month: mm, day: dd },
    }
  }
  return null
}

/**
 * Détermine l'année du broadcast : on prefère l'année du post (le board affiche
 * les posts récents). Si le mois/jour est nettement dans le passé par rapport
 * au post (ex. board posté en janvier pour un broadcast de décembre précédent),
 * on garde l'année du post.
 *
 * En pratique le post est toujours posté 1-2 jours AVANT le broadcast → on
 * peut juste retourner postYear.
 */
export function resolveBroadcastYear(meta: BoardPostMeta): number {
  return meta.postYear
}

// Row de board générique (préemptions) : même colonne titre/date que
// POST_DATE_RE mais sans exiger le format épisode « [NNN회] ».
const BOARD_ROW_RE =
  /\|\s*\d+\s*\|\s*\[(.+?)\]\((https?:[^)]+)\)\s*\|\s*[^|]+\s*\|\s*(\d{2})-(\d{2})-(\d{2})\s*\|/g

/**
 * Avis de déprogrammation « 결방 공지 » du board SBS (constaté le 2026-08-08 :
 * « [결방 공지] 8월 2일(일), 8월 9일(일) SBS 인기가요 » — Inkigayo sans épisode
 * deux dimanches). Extrait chaque date `M월 D일` des posts dont le titre porte
 * 결방, en clés KST 'YYYY-MM-DD'. Année = celle du post ; un wrap décembre →
 * janvier (mois préempté très inférieur au mois du post) passe à l'année
 * suivante. Pur, testé.
 */
export function parseBoardPreemptions(markdown: string): { kstDay: string; postUrl: string }[] {
  const out = new Map<string, string>()
  for (const row of markdown.matchAll(BOARD_ROW_RE)) {
    const title = row[1]
    if (!title.includes('결방')) continue
    const postUrl = row[2]
    const postYear = 2000 + Number(row[3])
    const postMonth = Number(row[4])
    for (const d of title.matchAll(/(\d{1,2})월\s*(\d{1,2})일/g)) {
      const month = Number(d[1])
      const day = Number(d[2])
      if (month < 1 || month > 12 || day < 1 || day > 31) continue
      const year = month < postMonth - 6 ? postYear + 1 : postYear
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      if (!out.has(key)) out.set(key, postUrl)
    }
  }
  return [...out.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kstDay, postUrl]) => ({ kstDay, postUrl }))
}

export async function fetchSbsBoardLatestPost(
  boardUrl: string,
): Promise<{ meta: BoardPostMeta; postMarkdown: string } | null> {
  const boardRes = await fetch(`https://r.jina.ai/${boardUrl}`, {
    headers: { 'user-agent': 'KStageBot/0.1 (+https://kstage.vercel.app)' },
  })
  if (!boardRes.ok) throw new Error(`SBS board fetch failed: HTTP ${boardRes.status}`)
  const boardMd = await boardRes.text()
  const meta = parseBoardLatestPost(boardMd)
  if (!meta) {
    // Board 200 mais aucune row parsée : cache Jina périmé/anti-bot OU format
    // de board changé. Sans ce warn, l'échec était indistinguable d'un board
    // simplement muet (constaté le 17/07 : run silencieusement vide, épisode
    // récupéré au run suivant — BACKLOG « fetch broadcaster silencieusement vide »).
    console.warn(
      `[sbs-board] ${boardUrl} : 200 mais 0 post parsé (markdown ${boardMd.length} o, début : ${JSON.stringify(boardMd.slice(0, 120))})`,
    )
    return null
  }

  const postRes = await fetch(`https://r.jina.ai/${meta.postUrl}`, {
    headers: { 'user-agent': 'KStageBot/0.1 (+https://kstage.vercel.app)' },
  })
  if (!postRes.ok) throw new Error(`SBS post fetch failed: HTTP ${postRes.status}`)
  const postMarkdown = await postRes.text()

  return { meta, postMarkdown }
}
