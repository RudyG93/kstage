import { requireAdminPage } from '@/lib/auth/require-admin'
import { getDebutCandidates, getLineupUnmatched } from '@/lib/debuts/actions'
import { DebutAdminList } from '@/components/debuts/debut-admin-list'
import { LineupUnmatchedList } from '@/components/debuts/lineup-unmatched-list'

export const metadata = { title: 'Debut candidates' }

// File de revue des debuts détectés (R4-I) : les candidats hors gate
// automatique attendent ici — un coup d'œil par jour suffit.
export default async function AdminDebutsPage() {
  await requireAdminPage()

  const [candidates, lineupUnmatched] = await Promise.all([
    getDebutCandidates(),
    getLineupUnmatched(),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Debut candidates</h1>
          {/* Liste de travail : seules les rows EN ATTENTE s'affichent (retour
              Rudy 2026-08-20) — l'historique créé/écarté vit en DB. */}
          <p className="text-muted-foreground text-sm">{candidates.length} en attente</p>
        </div>
        {/* Artistes des lineups music-show absents du roster (2026-07-17) :
            triés par récurrence, alimentés par le cron scrape-music-shows. */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Lineup unmatched — {lineupUnmatched.length} pending
          </h2>
          <LineupUnmatchedList items={lineupUnmatched} />
        </section>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Fandom debut scan</h2>
          <DebutAdminList items={candidates} />
        </section>
      </div>
    </div>
  )
}
