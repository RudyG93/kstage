import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { getDebutCandidates } from '@/lib/debuts/actions'
import { DebutAdminList } from '@/components/debuts/debut-admin-list'

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

  const candidates = await getDebutCandidates()
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
        <DebutAdminList items={candidates} />
      </div>
    </div>
  )
}
