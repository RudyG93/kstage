import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { getCareerPath, getMemberBySlug, getMemberSlugById } from '@/lib/members/queries'
import { faceCrop } from '@/lib/images/cloudinary'

const formatBirthday = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso))

const statusLabel = {
  active: null,
  former: 'Former member',
  pre_debut: 'Pre-debut',
} as const

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const member = await getMemberBySlug(slug)
  if (!member) notFound()

  // Membership historique → redirect 308 vers la canonique (= identité actuelle
  // de l'artiste). Cf. PR-D-3.1 : ILLIT Youngseo → Allday Project Youngseo,
  // i-dle Soojin → Soojin solo.
  if (member.canonical_id) {
    const canonicalSlug = await getMemberSlugById(member.canonical_id)
    if (canonicalSlug && canonicalSlug !== slug) redirect(`/artists/${canonicalSlug}`)
  }

  // Supabase embed renvoie soit un objet (single FK), soit un array selon la cardinality.
  // `groups!inner` sur un FK simple → objet. On le narrow ici.
  const groupRaw = (member as { groups: unknown }).groups
  const group = (Array.isArray(groupRaw) ? groupRaw[0] : groupRaw) as {
    id: string
    slug: string
    name: string
    color_hex: string | null
    image_url: string | null
  } | null
  const color = group?.color_hex ?? '#888'
  const initial = member.stage_name.slice(0, 1).toUpperCase()
  // Image : photo du membre en priorité ; à défaut l'image du groupe (cas solo
  // type Jennie où le membre n'a pas de photo mais le groupe is_solo si).
  const photo = member.photo_url ?? (group?.image_url ? faceCrop(group.image_url, 192, 192) : null)
  const statusText = statusLabel[member.status]
  const career = await getCareerPath(member.id)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <header className="flex items-start gap-4">
          <div className="bg-muted relative size-24 shrink-0 overflow-hidden rounded-xl">
            {photo ? (
              <Image src={photo} alt="" fill unoptimized sizes="96px" className="object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${color} 0%, ${color}33 100%)`,
                }}
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

        {career.length > 1 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Career</h2>
            <ul className="space-y-2">
              {career.map((step) => {
                const stepGroupRaw = (step as { groups: unknown }).groups
                const stepGroup = (
                  Array.isArray(stepGroupRaw) ? stepGroupRaw[0] : stepGroupRaw
                ) as { slug: string; name: string; color_hex: string | null } | null
                if (!stepGroup) return null
                const label = statusLabel[step.status] ?? 'Active'
                return (
                  <li key={step.id} className="text-sm">
                    <span
                      className="mr-2 inline-block size-2 rounded-full align-middle"
                      style={{ backgroundColor: stepGroup.color_hex ?? 'var(--muted-foreground)' }}
                      aria-hidden
                    />
                    <Link
                      href={`/groups/${stepGroup.slug}`}
                      className="font-medium hover:underline"
                    >
                      {stepGroup.name}
                    </Link>
                    <span className="text-muted-foreground"> — {label}</span>
                    {step.former_reason && (
                      <p className="text-muted-foreground mt-0.5 ml-4 text-xs">
                        {step.former_reason}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
