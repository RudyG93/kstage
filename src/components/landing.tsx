import Link from 'next/link'
import { ArrowRight, BellRing, CalendarHeart, Globe2 } from 'lucide-react'
import type { GroupSummary } from '@/lib/groups/queries'

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

export function Landing({ groups }: { groups: GroupSummary[] }) {
  return (
    <div className="space-y-16 py-6 sm:py-10">
      {/* Hero */}
      <section className="flex flex-col items-center text-center">
        <span
          className="text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-2 border-border/60 bg-card/50 mb-6 rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.18em] uppercase duration-700"
          style={{ animationFillMode: 'both' }}
        >
          K-pop event calendar
        </span>

        <h1
          className="animate-in fade-in-0 slide-in-from-bottom-3 text-4xl leading-[1.05] font-extrabold tracking-tight duration-700 sm:text-5xl"
          style={{ animationDelay: '90ms', animationFillMode: 'both' }}
        >
          Never miss a{' '}
          <span className="bg-gradient-to-r from-[#8b5cff] to-[#ff2d87] bg-clip-text text-transparent">
            comeback
          </span>{' '}
          again.
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
            className="focus-visible:ring-ring/50 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8b5cff] to-[#ff2d87] px-6 text-base font-semibold text-white shadow-lg shadow-[#8b5cff]/25 transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 sm:w-auto"
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

        <p className="text-muted-foreground/70 mt-4 font-mono text-[11px] tracking-wider">
          Free · No spam · Your timezone
        </p>
      </section>

      {/* Features */}
      <section className="space-y-3">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="bg-card/60 border-border/70 flex items-start gap-4 rounded-xl border p-4"
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

      {/* Groups preview */}
      {groups.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">Now tracking</h2>
            <span className="text-muted-foreground font-mono text-[11px] tracking-wider uppercase">
              {groups.length} groups
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {groups.map((group) => (
              <li
                key={group.id}
                className="bg-card/60 border-border/70 flex items-center gap-2.5 rounded-lg border px-3 py-2.5"
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: group.color_hex ?? 'var(--muted-foreground)',
                    boxShadow: group.color_hex ? `0 0 10px ${group.color_hex}99` : undefined,
                  }}
                  aria-hidden
                />
                <span className="truncate text-sm font-medium">{group.name}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-center text-sm">
            More groups added as fans request them.
          </p>
        </section>
      )}
    </div>
  )
}
