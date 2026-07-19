import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { ArtistHero } from '@/components/group/artist-hero'
import { CollapsibleMvs } from '@/components/group/collapsible-mvs'
import { LinksBar } from '@/components/group/links-bar'
import { MvCard } from '@/components/group/mv-card'
import { MembersGrid } from '@/components/member/members-grid'
import { PageRails } from '@/components/layout/page-rails'
import { EventList } from '@/components/event-list'
import { EmptyState } from '@/components/ui/empty-state'
import { FollowButton } from '@/components/follow-button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getCareerPath,
  getMemberBySlug,
  getMemberSlugById,
  getMembersForGroup,
} from '@/lib/members/queries'
import { getUpcomingEvents, getGroupMvs, getMemberMvs } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { faceCrop } from '@/lib/images/cloudinary'
import { groupBannerSrc } from '@/lib/groups/banner'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { getViewer } from '@/lib/supabase/viewer'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const member = await getMemberBySlug(slug)
  if (!member) return { title: 'Artist not found · KStage' }
  const group = member.groups
  const context = group && !group.is_solo ? ` (${group.name})` : ''
  return {
    title: `${member.stage_name} — profile & schedule`,
    description: `${member.stage_name}${context} — upcoming events, MVs and profile on KStage.`,
    alternates: { canonical: `/artists/${slug}` },
    openGraph: {
      title: `${member.stage_name} — profile & schedule · KStage`,
      description: `${member.stage_name}${context} on KStage.`,
    },
  }
}

// `members.birthday` est une date calendaire pure ('YYYY-MM-DD' → minuit UTC
// via new Date) : formater en UTC, jamais dans un fuseau — un fuseau négatif
// afficherait la veille ('Asia/Seoul' ne marchait que par chance, +9 > 0).
const formatBirthday = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso))

const statusLabel = {
  active: null,
  former: 'Former member',
  pre_debut: 'Pre-debut',
  deceased: 'In memoriam',
} as const

type Member = NonNullable<Awaited<ReturnType<typeof getMemberBySlug>>>
type CareerStep = Awaited<ReturnType<typeof getCareerPath>>[number]

function CareerSection({ career }: { career: CareerStep[] }) {
  if (career.length <= 1) return null
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Career</h2>
      <ul className="space-y-2">
        {career.map((step) => {
          const stepGroupRaw = (step as { groups: unknown }).groups
          const stepGroup = (Array.isArray(stepGroupRaw) ? stepGroupRaw[0] : stepGroupRaw) as {
            slug: string
            name: string
            color_hex: string | null
          } | null
          if (!stepGroup) return null
          const label = statusLabel[step.status] ?? 'Active'
          return (
            <li key={step.id} className="text-sm">
              <span
                className="mr-2 inline-block size-2 rounded-full align-middle"
                style={{ backgroundColor: stepGroup.color_hex ?? 'var(--muted-foreground)' }}
                aria-hidden
              />
              <Link href={`/groups/${stepGroup.slug}`} className="font-medium hover:underline">
                {stepGroup.name}
              </Link>
              <span className="text-muted-foreground"> — {label}</span>
              {step.former_reason && (
                <p className="text-muted-foreground mt-0.5 ml-4 text-xs">{step.former_reason}</p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type ArtistGroup = {
  id: string
  slug: string
  name: string
  color_hex: string | null
  agency: string | null
  image_url: string | null
  is_solo: boolean
  links: Record<string, string> | null
  banner_url: string | null
  banner_yt_url: string | null
  image_landscape: string | null
}

/** Bouton Follow du hero solo — dépend du viewer, streamé dans le slot (Lot G). */
async function SoloFollow({ group }: { group: ArtistGroup }) {
  const [{ user }, followedIds] = await Promise.all([getViewer(), getFollowedGroupIds()])
  return (
    <FollowButton
      groupId={group.id}
      initialFollowing={followedIds.has(group.id)}
      isAuthed={!!user}
      iconOnly
      large
    />
  )
}

function ArtistBodySkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  )
}

/** Corps solo (events, MVs, carrière) — streamé après le hero (Lot G). */
async function SoloBody({ member, group }: { member: Member; group: ArtistGroup }) {
  const [events, mvs, career, timeZone] = await Promise.all([
    getUpcomingEvents({ groupSlug: group.slug, limit: 20 }),
    getGroupMvs(group.slug, 48),
    getCareerPath(member.id),
    getViewerTimeZone(),
  ])
  const ratings = await getRatingsForEvents(mvs.map((m) => m.id))

  return (
    <>
      <section className="space-y-3">
        {/* Lien Calendar au niveau du titre (R5) — pas de ligne en plus. */}
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">Upcoming events</h2>
          <Link
            href={`/calendar?group=${group.slug}`}
            className="label-data-inline text-primary hover:text-primary/80 text-[10px] font-semibold transition-colors"
          >
            Calendar →
          </Link>
        </div>
        <EventList
          events={events}
          scrollAfter={5}
          empty={
            <EmptyState
              title="No upcoming events"
              description="Nothing scheduled yet. Check the calendar for this artist."
              action={{ label: 'Open calendar', href: `/calendar?group=${group.slug}` }}
            />
          }
        />
      </section>

      {mvs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Music videos ({mvs.length})</h2>
          <CollapsibleMvs mvs={mvs} ratings={ratings} timeZone={timeZone} />
        </section>
      )}

      <CareerSection career={career} />
    </>
  )
}

/** Corps membre (solo releases, carrière, groupmates) — streamé après le header (Lot G).
 * R10 — contenu unique : MVs solo (mv_kind='member', jusque-là jamais affichés)
 * + « groupmates » (les autres membres actifs du groupe) pour que la page ne
 * soit plus un cul-de-sac maigre. Les fetchs indépendants partent ENSEMBLE ;
 * seuls les ratings dépendent des MVs. */
async function MemberBody({ member, group }: { member: Member; group: ArtistGroup | null }) {
  const [memberMvs, groupmatesRaw, career, timeZone] = await Promise.all([
    getMemberMvs(member.id),
    group ? getMembersForGroup(group.id) : Promise.resolve([]),
    getCareerPath(member.id),
    getViewerTimeZone(),
  ])
  const memberRatings =
    memberMvs.length > 0 ? await getRatingsForEvents(memberMvs.map((m) => m.id)) : null
  const groupmates = groupmatesRaw.filter((m) => m.id !== member.id && m.status === 'active')

  return (
    <>
      {memberMvs.length > 0 && (
        <section className="space-y-2">
          <span className="label-data">Solo releases</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {memberMvs.map((mv) => (
              <MvCard key={mv.id} mv={mv} rating={memberRatings?.get(mv.id)} timeZone={timeZone} />
            ))}
          </div>
        </section>
      )}

      <CareerSection career={career} />

      {groupmates.length > 0 && group && (
        <section className="space-y-2">
          <span className="label-data">{group.name} members</span>
          <MembersGrid members={groupmates} groupColorHex={group.color_hex} />
        </section>
      )}
    </>
  )
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // Lot G — invariant soft-404 : les SEULS awaits bloquants sont ce check
  // d'existence (mémoïsé, partagé avec generateMetadata) et la résolution du
  // redirect canonique. notFound()/redirect() tombent AVANT tout streaming.
  const member = await getMemberBySlug(slug)
  if (!member) notFound()

  // Membership historique → redirect 308 vers la canonique (identité actuelle).
  if (member.canonical_id) {
    const canonicalSlug = await getMemberSlugById(member.canonical_id)
    if (canonicalSlug && canonicalSlug !== slug) redirect(`/artists/${canonicalSlug}`)
  }

  // `groups!inner` sur un FK simple → objet (parfois array selon cardinality).
  const groupRaw = (member as { groups: unknown }).groups
  const group = (Array.isArray(groupRaw) ? groupRaw[0] : groupRaw) as ArtistGroup | null

  // ── Artiste solo : même traitement que la page groupe (bandeau, follow, liens,
  // events, MVs via le groupe is_solo). ──────────────────────────────────────
  if (group?.is_solo) {
    const heroSrc = member.photo_url ?? group.image_url
    // Chaîne bannière unifiée (R4-B) — image_url surchargé par heroSrc : pour
    // un solo, la photo du membre est plus représentative que le carré Spotify
    // si la bannière YT manque.
    const bannerSrc = groupBannerSrc({ ...group, image_url: heroSrc })

    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="space-y-6">
          {/* SHELL : hero + fiche depuis la row membre/groupe ; le follow
              (viewer) et le corps (events, MVs, carrière) streament (Lot G). */}
          <ArtistHero
            name={member.stage_name}
            image={bannerSrc}
            follow={
              <Suspense fallback={null}>
                <SoloFollow group={group} />
              </Suspense>
            }
          />

          <div className="space-y-3">
            {group.agency && <p className="text-muted-foreground text-sm">{group.agency}</p>}
            <LinksBar links={group.links} />
          </div>

          {(member.real_name || member.birthday) && (
            <section className="text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                {member.real_name && (
                  <>
                    <dt className="text-muted-foreground">Real name</dt>
                    <dd>{member.real_name}</dd>
                  </>
                )}
                {member.birthday && (
                  <>
                    <dt className="text-muted-foreground">Birthday</dt>
                    <dd>{formatBirthday(member.birthday)}</dd>
                  </>
                )}
              </dl>
            </section>
          )}

          <Suspense fallback={<ArtistBodySkeleton />}>
            <SoloBody member={member} group={group} />
          </Suspense>
        </div>
      </div>
    )
  }

  // ── Membre de groupe : vue centrée membre (inchangée). ─────────────────────
  const color = group?.color_hex ?? '#888'
  const initial = member.stage_name.slice(0, 1).toUpperCase()
  const photoRaw = member.photo_url ?? group?.image_url ?? null
  const photo = photoRaw ? faceCrop(photoRaw, 192, 192) : null
  const statusText = statusLabel[member.status]

  return (
    <PageRails>
      <div className="space-y-6 px-4 md:px-0">
        {/* SHELL : header + fiche depuis la row membre ; le corps (solo
            releases, carrière, groupmates) streame (Lot G). */}
        <header className="flex items-start gap-4">
          <div className="bg-muted relative size-24 shrink-0 overflow-hidden rounded-xl">
            {photo ? (
              <Image src={photo} alt="" fill unoptimized sizes="96px" className="object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}33 100%)` }}
                aria-hidden
              >
                <span className="text-4xl font-bold text-white/90 drop-shadow-sm">{initial}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{member.stage_name}</h1>
            {group && (
              <p className="text-muted-foreground mt-0.5 text-sm">
                <Link href={`/groups/${group.slug}`} className="hover:underline">
                  {group.name}
                </Link>
              </p>
            )}
            {statusText && (
              <Badge variant="outline" className="mt-2">
                {statusText}
              </Badge>
            )}
            {/* Réseaux du membre (R8) — Instagram, Weverse… via le LinksBar. */}
            <div className="mt-2">
              <LinksBar links={member.links as Record<string, string> | null} compact />
            </div>
          </div>
        </header>

        <section className="space-y-2 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {member.real_name && (
              <>
                <dt className="text-muted-foreground">Real name</dt>
                <dd>{member.real_name}</dd>
              </>
            )}
            {member.birthday && (
              <>
                <dt className="text-muted-foreground">Birthday</dt>
                <dd>{formatBirthday(member.birthday)}</dd>
              </>
            )}
            {member.position && (
              <>
                <dt className="text-muted-foreground">Position</dt>
                <dd>{member.position}</dd>
              </>
            )}
            {member.former_reason && (
              <>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{member.former_reason}</dd>
              </>
            )}
          </dl>
        </section>

        <Suspense fallback={<ArtistBodySkeleton />}>
          <MemberBody member={member} group={group} />
        </Suspense>
      </div>
    </PageRails>
  )
}
