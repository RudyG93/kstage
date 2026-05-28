import type { Metadata } from 'next'
import { MvsGrid } from '@/components/group/mvs-grid'
import { getAllMvs } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getFollowedGroupIds } from '@/lib/follows/queries'

export const metadata: Metadata = {
  title: 'Music videos',
  description: 'Browse all k-pop music videos tracked on KStage.',
}

export default async function MvsPage() {
  const followedIds = await getFollowedGroupIds()
  const followedArr = Array.from(followedIds)

  // Two queries en parallèle : MVs des followed + tous (avec un cap raisonnable).
  // On filtre côté JS pour exclure du "All" ceux déjà montrés dans "From your groups".
  const [followedMvs, allMvs] = await Promise.all([
    followedArr.length > 0 ? getAllMvs({ groupIds: followedArr, limit: 60 }) : Promise.resolve([]),
    getAllMvs({ limit: 120 }),
  ])

  const followedIdsSet = new Set(followedMvs.map((m) => m.id))
  const otherMvs = allMvs.filter((m) => !followedIdsSet.has(m.id))

  // Une seule query batch pour toutes les notes affichées (followed + others).
  const ratings = await getRatingsForEvents([
    ...followedMvs.map((m) => m.id),
    ...otherMvs.map((m) => m.id),
  ])

  const total = allMvs.length
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="space-y-8">
        <header>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Music videos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {total === 0 ? 'No music videos tracked yet.' : `${total} music videos tracked.`}
          </p>
        </header>

        {followedMvs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">From your groups</h2>
            <MvsGrid mvs={followedMvs} ratings={ratings} />
          </section>
        )}

        {otherMvs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">
              {followedMvs.length > 0 ? 'More music videos' : 'All music videos'}
            </h2>
            <MvsGrid mvs={otherMvs} ratings={ratings} />
          </section>
        )}
      </div>
    </div>
  )
}
