import Image from 'next/image'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { faceCrop } from '@/lib/images/cloudinary'
import type { MemberSummary } from '@/lib/members/queries'

/**
 * Carte membre 84px du rail (§7.6.5) : portrait rounded-xl (fallback
 * gradient couleur groupe + initiale), nom, position. Bias = ring dorée + ★.
 *
 * Volontairement non navigable : la page membre `/artists/[slug]` est quasi-vide
 * et redondante avec ce rail → on ne crée plus de cul-de-sac.
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
  const color = groupColorHex ?? '#888'
  const isDimmed = member.status !== 'active'

  return (
    <div className={cn('block', isDimmed && 'opacity-70')}>
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
        <p className="truncate text-[11px] leading-snug font-semibold">{member.stage_name}</p>
        <p className="label-data-inline text-faint truncate text-[8px]">
          {member.status === 'active'
            ? (member.position ?? '—')
            : member.status === 'former'
              ? 'Former'
              : 'Pre-debut'}
        </p>
      </div>
    </div>
  )
}
