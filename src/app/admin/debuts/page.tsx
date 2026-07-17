import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { getDebutCandidates, getLineupUnmatched } from '@/lib/debuts/actions'
import { DebutAdminList } from '@/components/debuts/debut-admin-list'
import { LineupUnmatchedList } from '@/components/debuts/lineup-unmatched-list'

export const metadata = { title: 'Debut candidates' }

// File de revue des debuts détectés (R4-I) : les candidats hors gate
// automatique attendent ici — un coup d'œil par jour suffit.
export default async function AdminDebutsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) redirect('/')

  const [candidates, lineupUnmatched] = await Promise.all([
    getDebutCandidates(),
    getLineupUnmatched(),
  ])
  const pending = candidates.filter((c) => c.status === 'pending').length

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Debut candidates</h1>
          <p className="text-muted-foreground text-sm">
            {candidates.length} détectés · {pending} en attente
          </p>
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
