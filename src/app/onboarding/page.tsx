import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNonSoloGroups } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { OnboardingGrid } from '@/components/onboarding/onboarding-grid'

export const metadata = { title: 'Welcome to KStage' }

// Onboarding « follow d'abord » : montré une fois, juste après la 1ʳᵉ connexion
// (redirect depuis verifySignupOtp). Garde anti-vide : un nouveau compte suit
// quelques groupes → sa home n'est jamais vide.
export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Déjà des follows → onboarding inutile, on passe.
  const followed = await getFollowedGroupIds()
  if (followed.size > 0) redirect('/')

  const [groups, { data: counts }] = await Promise.all([
    getNonSoloGroups(),
    supabase.rpc('group_follow_counts'),
  ])
  const pop = new Map((counts ?? []).map((r) => [r.group_id, r.follows]))
  const top = [...groups]
    .sort((a, b) => (pop.get(b.id) ?? 0) - (pop.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 30)
    .map((g) => ({ id: g.id, name: g.name, image: g.image_url }))

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <OnboardingGrid groups={top} />
    </div>
  )
}
