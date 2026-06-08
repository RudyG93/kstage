import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { MemberSummary } from '@/lib/members/queries'

/**
 * Carte membre NON cliquable : photo si dispo, sinon placeholder gradient dérivé
 * de `color_hex` du groupe parent + initiale du stage_name.
 *
 * Volontairement non navigable : la page membre `/artists/[slug]` est quasi-vide
 * et redondante avec cette grille → on ne crée plus de cul-de-sac. La route reste
 * (redirect solo + artistes solo riches), juste plus d'entrée depuis la grille.
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

  return (
    <div className={cn('block', isDimmed && 'opacity-70')}>
      <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-xl">
        {member.photo_url ? (
          <Image
            src={member.photo_url}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 640px) 25vw, 33vw"
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
    </div>
  )
}
