import Link from 'next/link'
import { ArrowRight, BellRing, CalendarHeart, Globe2 } from 'lucide-react'
import { NextDropCard } from '@/components/home/next-drop-card'
import { HomeEventCard } from '@/components/home/event-card'
import { GroupCard } from '@/components/group-card'
import type { GroupSummary } from '@/lib/groups/queries'
import type { UpcomingEvent } from '@/lib/events/queries'

const FEATURES = [
  {
    icon: CalendarHeart,
    title: 'Follow your groups',
    desc: 'Pick your biases. KStage filters out everyone else — your calendar, no noise.',
  },
  {
    icon: BellRing,
    title: 'Notified at the right time',
    desc: 'Push alerts for comebacks, music shows and lives. J-1, day-of, or whenever you choose.',
  },
  {
    icon: Globe2,
    title: 'In your timezone',
    desc: 'Every drop shown in KST and your local time. No more 3am math before a release.',
  },
] as const

// Nombre de groupes (avec photo) montrés dans la grille d'aperçu.
const PHOTO_GRID_COUNT = 12

export function Landing({
  groups,
  previewEvents,
}: {
  groups: GroupSummary[]
  previewEvents: UpcomingEvent[]
}) {
  const nextDrop = previewEvents[0] ?? null
  const previewRows = previewEvents.slice(1, 4)
  const photoGroups = groups.filter((g) => g.image_url).slice(0, PHOTO_GRID_COUNT)

  return (
    <div className="space-y-16 py-6 sm:py-10">
      {/* Hero */}
      <section className="flex flex-col items-center text-center">
        <span
          className="text-faint animate-in fade-in-0 slide-in-from-bottom-2 border-border/60 bg-card/50 mb-6 rounded-full border px-3 py-1 text-xs font-semibold duration-700"
          style={{ animationFillMode: 'both' }}
        >
          K-pop event calendar
        </span>

        <h1
          className="animate-in fade-in-0 slide-in-from-bottom-3 text-4xl leading-[1.05] font-extrabold tracking-tight duration-700 sm:text-5xl"
          style={{ animationDelay: '90ms', animationFillMode: 'both' }}
        >
          Never miss a <span className="gradient-text">comeback</span> again.
        </h1>

        <p
          className="text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-3 mt-5 max-w-md text-base leading-relaxed duration-700 sm:text-lg"
          style={{ animationDelay: '180ms', animationFillMode: 'both' }}
        >
          The personal calendar for k-pop fans. Follow your groups and get notified the moment
          something drops — wherever you are.
        </p>

        <div
          className="animate-in fade-in-0 slide-in-from-bottom-3 mt-8 flex w-full flex-col items-center gap-3 duration-700 sm:w-auto sm:flex-row"
          style={{ animationDelay: '270ms', animationFillMode: 'both' }}
        >
          <Link
            href="/signup"
            className="focus-visible:ring-ring/50 bg-primary text-primary-foreground shadow-primary/25 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold shadow-lg transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 sm:w-auto"
          >
            Get started
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/login"
            className="border-border hover:bg-muted focus-visible:ring-ring/50 inline-flex h-11 w-full items-center justify-center rounded-xl border px-6 text-base font-medium transition-colors outline-none focus-visible:ring-3 sm:w-auto"
          >
            Sign in
          </Link>
        </div>

        <p className="label-data-inline text-muted-foreground/70 mt-4 text-[10px]">
          Free · No spam · Your timezone
        </p>
      </section>

      {/* Product preview — vrais prochains events pour montrer le produit en action */}
      {nextDrop && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span
              className="bg-teal size-2 rounded-full"
              style={{ boxShadow: '0 0 0 4px color-mix(in srgb, var(--teal) 18%, transparent)' }}
              aria-hidden
            />
            <span className="text-sm font-semibold">Coming up on KStage</span>
          </div>
          <div className="bg-card/30 border-border/60 space-y-3 rounded-2xl border p-3 sm:p-4">
            <NextDropCard event={nextDrop} />
            {previewRows.length > 0 && (
              <div className="space-y-2">
                {previewRows.map((event) => (
                  <HomeEventCard key={event.id} event={event} compact />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Groups preview — grille de photos (au lieu d'un mur de noms) */}
      {photoGroups.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">Track your groups</h2>
            <span className="label-data text-[10px]">{groups.length} groups</span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photoGroups.map((group) => (
              <GroupCard key={group.id} group={group} isFollowing={false} isAuthed={false} />
            ))}
          </div>
          <p className="text-muted-foreground text-center text-sm">
            …and {groups.length - photoGroups.length}+ more — new groups added as fans request them.
          </p>
        </section>
      )}

      {/* Features */}
      <section className="grid gap-3 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="bg-card/60 border-border/70 flex flex-col gap-3 rounded-xl border p-4"
          >
            <span className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight">{title}</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Closing CTA */}
      <section className="bg-card/40 border-border/60 flex flex-col items-center gap-4 rounded-2xl border px-6 py-10 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Your k-pop calendar, sorted.</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Free to use. Follow your groups, get a clean schedule and timely alerts.
        </p>
        <Link
          href="/signup"
          className="focus-visible:ring-ring/50 bg-primary text-primary-foreground shadow-primary/25 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold shadow-lg transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3"
        >
          Get started
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </div>
  )
}
