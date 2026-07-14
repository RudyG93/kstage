import Image from 'next/image'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { faceCrop } from '@/lib/images/cloudinary'
import { ageFromBirthday, type MemberSummary } from '@/lib/members/queries'

/**
 * Carte membre 84px du rail (§7.6.5) : portrait rounded-xl (fallback
 * gradient couleur groupe + initiale), nom, position. Bias = ring dorée + ★.
 *
 * Navigable vers `/artists/[slug]` depuis R8 : la page membre a désormais du
 * contenu unique (réseaux, birthday, carrière) — ce n'est plus un cul-de-sac.
 * Fallback `<div>` si le membre n'a pas de slug.
 */
export function MemberCard({
  member,
  groupColorHex,
  isBias = false,
}: {
  member: MemberSummary
  groupColorHex: string | null
  isBias?: boolean
}) {
  const initial = member.stage_name.slice(0, 1).toUpperCase()
  const age = ageFromBirthday(member.birthday)
  const color = groupColorHex ?? '#888'
  // Les décédés ne sont PAS grisés (honorés à pleine présence, In memoriam).
  const isDimmed = member.status !== 'active' && member.status !== 'deceased'

  const inner = (
    <>
      <div
        className={cn(
          'bg-muted relative aspect-square w-full overflow-hidden rounded-xl',
          isBias && 'ring-amber ring-2',
        )}
      >
        {member.photo_url ? (
          <Image
            // faceCrop = proxy Cloudinary (certains hosts comme kprofiles bloquent
            // le hotlinking direct) + centrage visage (g_auto).
            src={faceCrop(member.photo_url, 200, 200)}
            alt=""
            fill
            unoptimized
            sizes="84px"
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
            <span className="text-xl font-bold text-white/90 drop-shadow-sm">{initial}</span>
          </div>
        )}
        {isBias && (
          <span
            className="bg-amber absolute top-1 right-1 flex size-4 items-center justify-center rounded-full"
            title="Your bias"
          >
            <Star className="size-2.5 fill-white text-white" aria-hidden />
          </span>
        )}
      </div>
      <div className="mt-1 px-0.5">
        {/* line-clamp-2 : les noms longs (Jang Wonyoung) ne sont plus tronqués
            sur une carte de 84px (retour Rudy 2026-07-12). */}
        <p className="line-clamp-2 text-[11px] leading-snug font-semibold">{member.stage_name}</p>
        {/* Sous-titre : position, sinon ÂGE (le « — » ne disait rien), sinon
            rien du tout. */}
        {(member.status !== 'active' || member.position || age !== null) && (
          <p className="label-data-inline text-faint truncate text-[8px]">
            {member.status === 'active'
              ? (member.position ?? `${age} yrs`)
              : member.status === 'former'
                ? 'Former'
                : member.status === 'deceased'
                  ? 'In memoriam'
                  : 'Pre-debut'}
          </p>
        )}
      </div>
    </>
  )

  return member.slug ? (
    <Link
      href={`/artists/${member.slug}`}
      className={cn(
        'group focus-visible:ring-primary/40 block rounded-xl outline-none focus-visible:ring-2',
        isDimmed && 'opacity-70',
      )}
    >
      {inner}
    </Link>
  ) : (
    <div className={cn('block', isDimmed && 'opacity-70')}>{inner}</div>
  )
}
