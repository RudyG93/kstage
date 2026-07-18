import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BellRing, HeartIcon, Star } from 'lucide-react'
import { Countdown } from '@/components/home/countdown'
import { TrackedLink } from '@/components/analytics/tracked-link'
import { isTimeTBA } from '@/lib/events/date'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { QueueRow } from '@/components/events/queue-row'
import { faceCrop } from '@/lib/images/cloudinary'
import { displayEventTitle } from '@/lib/events/title'
import type { GroupSummary } from '@/lib/groups/queries'
import type { UpcomingEvent } from '@/lib/events/queries'
import type { SourcesStatus } from '@/lib/sources/queries'
import { compactNumber } from '@/lib/utils'

const STEPS = [
  {
    icon: HeartIcon,
    title: 'Follow your groups',
    desc: 'One tap — everything else filters itself out.',
  },
  {
    icon: BellRing,
    title: 'Get pinged at the right time',
    // Copie alignée sur le comportement réel : le push announced a été coupé
    // (Phase 1 Lot 4) — J-1 + jour J, l'annonce vit dans le digest.
    desc: 'Day before and day of every drop — in your timezone.',
  },
  {
    icon: Star,
    title: 'Rate every drop /10',
    desc: 'The Letterboxd of k-pop: score it, discuss it, own your taste.',
  },
] as const

// Mur visuel : tuiles photos (3 colonnes) + tuile « +n ».
const WALL_COUNT = 11

// Landing Data Desk (§7.9) : la donnée vend le produit — badge live, preuve
// countdown temps réel, mur visuel, proof bar, 3 étapes, double CTA.
export function Landing({
  groups,
  previewEvents,
  eventsCount,
  sourcesStatus,
  subscriberCounts,
  timeZone,
}: {
  groups: GroupSummary[]
  previewEvents: UpcomingEvent[]
  eventsCount: number
  sourcesStatus: SourcesStatus | null
  /** Popularité (max subs YouTube par groupe) — tri du mur visuel. */
  subscriberCounts?: Map<string, number>
  /** Fuseau du viewer (cookie tz pour l'anonyme, KST au tout 1er rendu). */
  timeZone: string
}) {
  const nextDrop = previewEvents[0] ?? null
  const previewRows = previewEvents.slice(1, 4)
  // Mur trié par notoriété (subs YouTube) : les visages les plus connus d'abord.
  const wallGroups = groups
    .filter((g) => g.image_url)
    .sort((a, b) => (subscriberCounts?.get(b.id) ?? 0) - (subscriberCounts?.get(a.id) ?? 0))
    .slice(0, WALL_COUNT)
  const remaining = Math.max(0, groups.length - wallGroups.length)

  return (
    <div className="relative space-y-10 py-4 sm:py-8">
      {/* Halo discret en haut — seule exception « glow » (page marketing §7.9.2). */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        aria-hidden
        style={{
          background:
            'radial-gradient(340px 240px at 85% -6%, color-mix(in srgb, var(--primary) 20%, transparent), transparent 65%), radial-gradient(280px 200px at -5% 10%, color-mix(in srgb, var(--teal) 9%, transparent), transparent 60%)',
        }}
      />

      {/* Badge + H1 + sous-titre — centré dès sm (le bloc justifié à gauche
          tranchait avec le halo, retour Rudy) ; gauche sur petits écrans. */}
      <section className="relative sm:text-center">
        <p className="flex items-center gap-2 sm:justify-center">
          <span className="bg-teal animate-upcoming-pulse size-[6px] rounded-full" aria-hidden />
          <span className="label-data-inline text-teal text-[9px] tracking-[0.2em]">
            {compactNumber(eventsCount)}+ events tracked live
          </span>
        </p>
        <h1 className="font-heading mt-3 text-[32px] leading-[1.06] font-extrabold tracking-[-0.028em]">
          Never miss a<br />
          comeback <span className="text-primary font-serif font-normal italic">again.</span>
        </h1>
        <p className="text-muted-foreground mt-3 max-w-[310px] text-[13px] leading-relaxed sm:mx-auto">
          The personal calendar for k-pop fans. Follow your groups and get notified the moment
          something drops — wherever you are.
        </p>
      </section>

      {/* Preuve courte : le prochain drop + countdown, COMPACT — l'ordre
          audit §8.3 est promesse → preuve → CTA au-dessus de la ligne de
          flottaison mobile ; le reste de la file vit dans « More coming up »
          plus bas. Label « Next up » (l'ancien « Happening right now »
          affichait un event FUTUR — trompeur, audit §8.7). */}
      {nextDrop && (
        <section className="relative">
          <Panel>
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <span
                className="bg-teal animate-upcoming-pulse size-[5px] rounded-full"
                aria-hidden
              />
              <span className="label-data text-[9px] tracking-[0.16em]">Next up on KStage</span>
            </div>
            <div className="space-y-3 p-3.5">
              <div>
                <p className="text-sm font-semibold">
                  {displayEventTitle(nextDrop.title, nextDrop.groups?.name, null, nextDrop.type)}
                </p>
                <p className="text-muted-foreground text-[11px]">{nextDrop.groups?.name}</p>
              </div>
              {!isTimeTBA(nextDrop) && <Countdown targetIso={nextDrop.start_at} variant="cells" />}
            </div>
          </Panel>
        </section>
      )}

      {/* CTA remonté au 2ᵉ écran mobile (audit §8.3 : il arrivait plusieurs
          écrans sous la ligne de flottaison). Répété en pied de page. */}
      <Cta />

      {/* Mur visuel (§7.9.5). */}
      {wallGroups.length > 0 && (
        <section className="relative space-y-2">
          <span className="label-data">{groups.length} groups &amp; soloists</span>
          <div className="grid grid-cols-3 gap-[9px] sm:grid-cols-4">
            {wallGroups.map((g) => (
              <Link
                key={g.id}
                href={`/groups/${g.slug}`}
                aria-label={g.name}
                className="focus-visible:ring-ring/50 group relative aspect-square overflow-hidden rounded-lg outline-none focus-visible:ring-2"
              >
                <Image
                  src={faceCrop(g.image_url!, 400, 400)}
                  alt=""
                  fill
                  unoptimized
                  sizes="(min-width: 640px) 25vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  aria-hidden
                />
                {/* Nom sobre mais lisible : scrim bas léger + petit label. */}
                <span
                  className="pointer-events-none absolute inset-x-0 bottom-0 px-1.5 pt-5 pb-1"
                  style={{
                    background:
                      'linear-gradient(180deg, transparent, color-mix(in srgb, var(--page) 78%, transparent))',
                  }}
                >
                  <span className="block truncate text-[10px] font-semibold">{g.name}</span>
                </span>
              </Link>
            ))}
            {remaining > 0 && (
              <Link
                href="/groups"
                className="bg-secondary hover:bg-hover focus-visible:ring-ring/50 flex aspect-square items-center justify-center rounded-lg border outline-none focus-visible:ring-2"
              >
                <span className="tabular text-muted-foreground text-lg font-bold">
                  +{remaining}
                </span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Recentrage calendrier (audit §12 action 2) : la suite de la file,
          avec un chemin explicite vers la vraie surface /calendar. */}
      {previewRows.length > 0 && (
        <section className="relative">
          <Panel>
            <PanelHeader
              label="More coming up"
              action={{ label: 'Full calendar', href: '/calendar' }}
            />
            <div className="divide-y">
              {previewRows.map((event) => (
                <QueueRow key={event.id} event={event} timeZone={timeZone} />
              ))}
            </div>
          </Panel>
        </section>
      )}

      {/* Proof bar (§7.9.6). */}
      <p className="tabular text-faint relative text-center text-[9px] font-semibold tracking-[0.18em] uppercase">
        {compactNumber(eventsCount)} events · {groups.length} groups
        {sourcesStatus ? ` · ${sourcesStatus.count} sources` : ''} · daily refresh
      </p>

      {/* 3 étapes (§7.9.7). */}
      <section className="relative space-y-3">
        {STEPS.map(({ icon: Icon, title, desc }, i) => (
          <div key={title} className="flex items-center gap-3">
            <span className="bg-primary/14 text-primary tabular flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-muted-foreground text-xs">{desc}</p>
            </div>
            <Icon className="text-rose size-4 shrink-0" aria-hidden />
          </div>
        ))}
      </section>

      {/* CTA répété en pied de page longue (§7.9.8). */}
      <Cta withPwaNote />
    </div>
  )
}

// Double CTA (§7.9.8) — rendu au 2ᵉ écran ET en pied de page. La note PWA ne
// s'affiche qu'en bas (le CTA haut reste net).
function Cta({ withPwaNote = false }: { withPwaNote?: boolean }) {
  return (
    <section className="relative space-y-3">
      <TrackedLink
        event="landing_cta_clicked"
        eventProps={{ cta: 'signup' }}
        href="/signup"
        className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 flex h-11 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-bold shadow-[0_8px_20px_rgba(125,122,255,.3)] transition-colors outline-none focus-visible:ring-2"
      >
        Create your calendar — free
        <ArrowRight className="size-4" aria-hidden />
      </TrackedLink>
      <TrackedLink
        event="landing_cta_clicked"
        eventProps={{ cta: 'browse_calendar' }}
        href="/calendar"
        className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 text-xs font-semibold transition-colors"
      >
        Browse the calendar first
        <ArrowRight className="text-primary size-3.5" aria-hidden />
      </TrackedLink>
      {withPwaNote && (
        <p className="tabular text-faint pt-1 text-center text-[9px] font-semibold tracking-[0.16em] uppercase">
          PWA — install from your browser · no app store
        </p>
      )}
    </section>
  )
}
