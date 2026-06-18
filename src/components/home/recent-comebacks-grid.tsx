import Link from 'next/link'
import { MvsGrid, type RatingMap } from '@/components/group/mvs-grid'
import { EmptyState } from '@/components/ui/empty-state'
import type { MvEvent } from '@/lib/events/queries'

function Section({
  label,
  href,
  children,
}: {
  label: string
  href?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{label}</h2>
        {href && (
          <Link href={href} className="text-primary text-xs underline-offset-2 hover:underline">
            View all →
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/**
 * Bloc visuel central de la home (« valoriser la data ») : grilles de MV avec
 * thumbnails + notes. « From your groups » (perso) si l'user suit des groupes,
 * sinon un CTA pour suivre ; puis « Recent comebacks » (global, découverte).
 */
export function RecentComebacksGrid({
  fromYourGroups,
  recent,
  ratings,
  hasFollows,
}: {
  fromYourGroups: MvEvent[]
  recent: MvEvent[]
  ratings: RatingMap
  hasFollows: boolean
}) {
  return (
    <div className="space-y-8">
      {hasFollows ? (
        fromYourGroups.length > 0 && (
          <Section label="From your groups" href="/mvs">
            <MvsGrid mvs={fromYourGroups} ratings={ratings} />
          </Section>
        )
      ) : (
        <EmptyState
          title="Follow groups to make this yours"
          description="Pick the artists you love and their comebacks, MVs and birthdays land here automatically."
          action={{ label: 'Browse groups', href: '/groups' }}
        />
      )}

      {recent.length > 0 && (
        <Section label="Recent comebacks" href="/mvs">
          <MvsGrid mvs={recent} ratings={ratings} />
        </Section>
      )}
    </div>
  )
}
