import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { MemberSummary } from '@/lib/members/queries'

/**
 * Carte membre cliquable vers `/artists/[slug]`. Photo si dispo, sinon placeholder
 * gradient dérivé de `color_hex` du groupe parent + initiale du stage_name.
 *
 * Member without slug → rendu désactivé (avant que le backfill ait tourné en prod).
 */
export function MemberCard({
  member,
  groupColorHex,
}: {
  member: MemberSummary
  groupColorHex: string | null
}) {
  const initial = member.stage_name.slice(0, 1).toUpperCase()
  const color = groupColorHex ?? '#888'
  const isDimmed = member.status !== 'active'

  const content = (
    <>
      <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-xl">
        {member.photo_url ? (
          <Image
            src={member.photo_url}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 640px) 25vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}33 100%)`,
            }}
            aria-hidden
          >
            <span className="text-3xl font-bold text-white/90 drop-shadow-sm">{initial}</span>
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="line-clamp-1 text-sm leading-snug font-medium">{member.stage_name}</p>
        {member.status !== 'active' && (
          <p className="text-muted-foreground mt-0.5 font-mono text-[11px] tracking-wider uppercase">
            {member.status === 'former' ? 'Former' : 'Pre-debut'}
          </p>
        )}
      </div>
    </>
  )

  if (!member.slug) {
    return <div className={cn('block', isDimmed && 'opacity-70')}>{content}</div>
  }

  return (
    <Link
      href={`/artists/${member.slug}`}
      className={cn(
        'group focus-visible:ring-primary/40 block rounded-xl focus-visible:ring-2 focus-visible:outline-none',
        isDimmed && 'opacity-70',
      )}
    >
      {content}
    </Link>
  )
}
