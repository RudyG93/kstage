import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getGroupFollowCounts,
  getNonSoloGroupsCached,
  getSoloArtistsCached,
} from '@/lib/groups/queries'
import { getGroupEventCounts } from '@/lib/events/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { OnboardingGrid } from '@/components/onboarding/onboarding-grid'
import { TrackView } from '@/components/analytics/track-view'

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

  // Solistes INCLUS (2026-08-23) : la grille n'appelait que les groupes, or
  // l'onboarding est l'unique entonnoir à follows de l'app et il se saute dès
  // qu'un follow existe. Un fan de Lisa, G-Dragon ou Jackson Wang n'avait donc
  // aucune occasion de les suivre au seul moment prévu pour ça — 38 artistes
  // sur 260 invisibles à l'entrée. Variantes CACHÉES : même data publique pour
  // tout le monde, et la page était la seule à taper les non-cachées.
  const [nonSolo, solo, pop, eventCounts] = await Promise.all([
    getNonSoloGroupsCached(),
    getSoloArtistsCached(),
    getGroupFollowCounts(),
    getGroupEventCounts(),
  ])
  const groups = [...nonSolo, ...solo]
  // P0.6 : on met en avant en priorité les groupes au calendrier non vide (events
  // ou catalogue MV) — sinon un nouveau compte suit des groupes qui n'afficheront
  // rien. Tri : follows ↓ (utile dès qu'il y a des users), puis volume de contenu
  // ↓ (départage sur un compte neuf où follows ≈ 0), puis nom. Les groupes sans
  // contenu complètent jusqu'à 30 (l'onboarding ne doit jamais être clairsemé).
  const rank = (g: { id: string; name: string }) => ({
    pop: pop.get(g.id) ?? 0,
    content: eventCounts.get(g.id) ?? 0,
  })
  const sorted = [...groups].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    const aHas = ra.content > 0 ? 1 : 0
    const bHas = rb.content > 0 ? 1 : 0
    return bHas - aHas || rb.pop - ra.pop || rb.content - ra.content || a.name.localeCompare(b.name)
  })
  // Liste COMPLÈTE (la grille montre le top 30 par défaut, la recherche client
  // couvre tout — audit §12 action 3 : « trouver SES trois artistes »).
  const all = sorted.map((g) => ({ id: g.id, name: g.name, image: g.image_url }))

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <TrackView event="onboarding_started" />
      <OnboardingGrid groups={all} />
    </div>
  )
}
