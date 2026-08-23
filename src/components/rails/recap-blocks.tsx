import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { getOnThisDayMvs, getRecentShowWins } from '@/lib/events/queries'
import { displaySongTitle } from '@/lib/events/title'
import { monthYear } from '@/lib/events/date'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { faceCrop } from '@/lib/images/cloudinary'
import { SHOW_ID_BY_TITLE } from '@/lib/scrapers/music-shows/types'
import { Panel, PanelHeader } from '@/components/ui/panel'

// Blocs RÉCAPITULATIFS : ils ne montrent ni l'à-venir ni le catalogue, mais ce
// qui vient de se passer et ce qui s'est passé le même jour d'une autre année.
// C'est la famille que l'app n'avait pas — tous ses rails regardaient devant.

/** 1st, 2nd, 3rd, 4th… — 11/12/13 font exception. */
function ordinal(n: number): string {
  const m100 = n % 100
  if (m100 >= 11 && m100 <= 13) return `${n}th`
  const m10 = n % 10
  return `${n}${m10 === 1 ? 'st' : m10 === 2 ? 'nd' : m10 === 3 ? 'rd' : 'th'}`
}

/**
 * « Music show wins · this week » — qui a gagné, show par show.
 *
 * La donnée existe depuis le 2026-08-23 (lue sur Wikipedia par le cron) mais
 * n'avait AUCUNE vue d'ensemble : le vainqueur se lit sur la page d'un épisode
 * ou sur celle d'un groupe, jamais « qui a gagné cette semaine ». C'est
 * pourtant la question que le fandom pose chaque week-end, et le « Nth win »
 * en est la monnaie.
 *
 * Six lignes par semaine, une par show — mesuré, pas estimé. Le rang vient de
 * Wikipedia : on n'additionne jamais nous-mêmes, notre base ne couvre que
 * quelques mois.
 */
export async function ShowWinsBlock({ variant = 'rail' }: { variant?: 'rail' | 'panel' }) {
  const wins = await getRecentShowWins(7, 6)
  if (wins.length === 0) return null
  const rows = (
    <ul className={variant === 'panel' ? 'space-y-1 p-2' : 'space-y-1'}>
      {wins.map((w) => {
        const showId = SHOW_ID_BY_TITLE[w.show_title]
        const group = w.groups as unknown as {
          slug: string
          name: string
          image_url: string | null
        } | null
        return (
          <li key={`${w.show_title}-${w.kst_day}`}>
            <Link
              href={(showId ? `/show/${showId}/${w.kst_day}` : '/shows') as Route}
              className="hover:bg-hover -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
            >
              {group?.image_url ? (
                <Image
                  src={faceCrop(group.image_url, 64, 64)}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="size-8 shrink-0 rounded-[7px] object-cover"
                  aria-hidden
                />
              ) : (
                <span
                  className="bg-amber/15 text-amber flex size-8 shrink-0 items-center justify-center rounded-[7px]"
                  aria-hidden
                >
                  <Trophy className="size-4" strokeWidth={2} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                {/* Le nom du ROSTER quand il est résolu : Wikipedia écrit
                      « Ateez » et « Zerobaseone » là où l'app dit « ATEEZ » et
                      « ZEROBASEONE ». On garde le nom scrapé seulement pour les
                      vainqueurs hors roster (collaborations, solistes absents). */}
                <span className="block truncate text-xs font-semibold">
                  {group?.name ?? w.winner_name}
                </span>
                <span className="text-muted-foreground block truncate text-[10px]">
                  {w.show_title}
                  {w.winner_song ? ` · ${w.winner_song}` : ''}
                </span>
              </span>
              {w.winner_nth != null && (
                <span className="tabular text-amber shrink-0 text-[11px] font-semibold">
                  {ordinal(w.winner_nth)} win
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  // Au CENTRE d'une page (/shows), le bloc doit adopter l'idiome de la page —
  // un Panel, dont l'en-tête est un vrai <h2>. Rendu tel quel il gardait un
  // titre en <span> (la règle « un titre de section est un heading » vient
  // d'être posée) et une largeur pensée pour un rail de 320 px.
  if (variant === 'panel') {
    return (
      <Panel>
        <PanelHeader label="Music show wins · this week" />
        {rows}
      </Panel>
    )
  }
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <h2 className="label-data">Music show wins · this week</h2>
      </div>
      {rows}
    </section>
  )
}

/**
 * « On this day » — les clips sortis le même jour civil, les années passées.
 *
 * Le catalogue compte 3 173 clips et ne sert que le récent : rien ne fait
 * remonter l'archive. 9,7 clips partagent en moyenne le jour civil du jour.
 * Tri par ancienneté DÉCROISSANTE : « 10 yrs » porte plus que « 1 yr », et
 * c'est la seule mécanique du produit qui donne une raison de revenir un jour
 * où il ne sort rien.
 */
export async function OnThisDayBlock() {
  const [{ rows: mvs, referenceYear }, timeZone] = await Promise.all([
    getOnThisDayMvs(4),
    getViewerTimeZone(),
  ])
  if (mvs.length === 0) return null
  // `referenceYear` vient de la requête, ancré KST comme le jour interrogé :
  // le recalculer en UTC donnait « 0 yrs » neuf heures par an, entre 00:00 et
  // 09:00 KST le 1er janvier.
  const thisYear = referenceYear
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <h2 className="label-data">On this day</h2>
      </div>
      <ul className="space-y-1">
        {mvs.map((mv) => {
          const years = thisYear - Number(mv.start_at.slice(0, 4))
          return (
            <li key={mv.id}>
              <Link
                href={(mv.slug ? `/mv/${mv.slug}` : '/mvs') as Route}
                className="hover:bg-hover -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
              >
                {mv.groups?.image_url ? (
                  <Image
                    src={faceCrop(mv.groups.image_url, 64, 64)}
                    alt=""
                    width={32}
                    height={32}
                    unoptimized
                    className="size-8 shrink-0 rounded-[7px] object-cover"
                    aria-hidden
                  />
                ) : (
                  <span
                    className="gradient-signature flex size-8 shrink-0 items-center justify-center rounded-[7px] text-xs font-bold text-white"
                    aria-hidden
                  >
                    {mv.groups?.name?.[0] ?? '?'}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">
                    {displaySongTitle(mv.title, mv.groups?.name)}
                  </span>
                  <span className="text-muted-foreground block truncate text-[10px]">
                    {mv.groups?.name} · {monthYear(mv.start_at, timeZone)}
                  </span>
                </span>
                <span className="tabular text-muted-foreground shrink-0 text-[11px]">
                  {years} yr{years === 1 ? '' : 's'}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
