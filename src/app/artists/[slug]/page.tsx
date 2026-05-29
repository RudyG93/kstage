import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { getMemberBySlug } from '@/lib/members/queries'

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

  // Supabase embed renvoie soit un objet (single FK), soit un array selon la cardinality.
  // `groups!inner` sur un FK simple → objet. On le narrow ici.
  const groupRaw = (member as { groups: unknown }).groups
  const group = (Array.isArray(groupRaw) ? groupRaw[0] : groupRaw) as {
    id: string
    slug: string
    name: string
    color_hex: string | null
    agency: string | null
  } | null
  const color = group?.color_hex ?? '#888'
  const initial = member.stage_name.slice(0, 1).toUpperCase()
  const statusText = statusLabel[member.status]

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <header className="flex items-start gap-4">
          <div className="bg-muted relative size-24 shrink-0 overflow-hidden rounded-xl">
            {member.photo_url ? (
              <Image
                src={member.photo_url}
                alt=""
                fill
                unoptimized
                sizes="96px"
                className="object-cover"
              />
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
                {group.agency && <span> · {group.agency}</span>}
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
      </div>
    </div>
  )
}
