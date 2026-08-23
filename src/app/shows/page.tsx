import { Suspense } from 'react'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { SHOW_DESCRIPTORS } from '@/lib/scrapers/music-shows/types'
import { formatKst } from '@/lib/events/date'
import { SITE_URL } from '@/lib/site'
import { ShowWinsBlock } from '@/components/rails/recap-blocks'

export const metadata: Metadata = {
  title: 'Music shows',
  description: 'Every music show episode covered by KStage — lineups, stages and discussion.',
  alternates: { canonical: '/shows' },
  openGraph: {
    title: 'Music shows — KStage',
    description: 'Every music show episode covered by KStage.',
    url: `${SITE_URL}/shows`,
  },
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Index des music shows — les 64 pages épisode n'avaient AUCUN point d'entrée :
 * on n'y arrivait que par le calendrier, à la bonne date, ou par un passage sur
 * une page groupe. Une seule page pour les 6 shows plutôt qu'un `/shows/[show]`
 * par diffuseur : à 64 épisodes au total, six pages seraient six pages minces.
 */
export default async function ShowsPage() {
  const supabase = await createClient()
  // 64 lignes : la table entière tient largement, pas de pagination à prévoir
  // avant longtemps (6 shows × ~1 épisode/semaine).
  const { data } = await supabase
    .from('show_episodes')
    .select('show_title, kst_day, episode_number, start_at')
    .order('kst_day', { ascending: false })

  const byShow = new Map<string, NonNullable<typeof data>>()
  for (const row of data ?? []) {
    const list = byShow.get(row.show_title)
    if (list) list.push(row)
    else byShow.set(row.show_title, [row])
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Music shows</h1>
        <p className="text-muted-foreground text-sm">
          Weekly stages from the six Korean music shows — every episode with its lineup.
        </p>
      </div>

      {/* Avant la liste des épisodes : le palmarès de la semaine. C'est la
          question qu'on se pose en arrivant ici, et elle n'avait de réponse
          nulle part — le vainqueur ne se lisait que page par page. */}
      <Suspense fallback={null}>
        <ShowWinsBlock variant="panel" />
      </Suspense>

      {SHOW_DESCRIPTORS.map((show) => {
        const episodes = byShow.get(show.displayName) ?? []
        return (
          <Panel key={show.id}>
            <PanelHeader label={show.displayName} />
            <div className="flex items-center gap-3 border-b p-3">
              <Image
                src={show.iconUrl}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="size-10 shrink-0 rounded-lg object-cover"
                aria-hidden
              />
              <p className="text-muted-foreground text-xs">
                {/* The Show ne diffuse plus toutes les semaines (4 épisodes en
                    2026) : annoncer un créneau hebdo serait faux. */}
                {show.weekly
                  ? `${WEEKDAYS[show.slot.weekday]}s · ${String(show.slot.hour).padStart(2, '0')}:${String(
                      show.slot.minute,
                    ).padStart(2, '0')} KST`
                  : 'Irregular schedule'}
                {episodes.length > 0 &&
                  ` · ${episodes.length} episode${episodes.length === 1 ? '' : 's'}`}
              </p>
            </div>
            {episodes.length === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">No episode recorded yet.</p>
            ) : (
              <ul className="divide-y">
                {episodes.map((e) => (
                  <li key={`${show.id}-${e.kst_day}`}>
                    <Link
                      href={`/show/${show.id}/${e.kst_day}` as Route}
                      className="hover:bg-hover flex items-center justify-between gap-3 px-3 py-2 transition-colors"
                    >
                      <span className="text-sm font-medium">
                        {e.episode_number ? `#${e.episode_number}` : show.displayName}
                      </span>
                      <span className="tabular text-muted-foreground text-[11px]">
                        {formatKst(e.start_at, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )
      })}
    </div>
  )
}
