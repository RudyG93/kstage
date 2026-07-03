import { MemberCard } from './member-card'
import type { MemberSummary } from '@/lib/members/queries'

/**
 * Rail horizontal de membres (Data Desk §7.6.5) : cartes 84px scrollables.
 * Caller filtre par status si besoin. `biasMemberId` = ring dorée + ★.
 */
export function MembersGrid({
  members,
  groupColorHex,
  biasMemberId,
}: {
  members: MemberSummary[]
  groupColorHex: string | null
  biasMemberId?: string | null
}) {
  if (members.length === 0) return null
  return (
    <ul className="flex scrollbar-thin gap-2.5 overflow-x-auto pb-2">
      {members.map((m) => (
        <li key={m.id} className="w-[84px] shrink-0">
          <MemberCard member={m} groupColorHex={groupColorHex} isBias={m.id === biasMemberId} />
        </li>
      ))}
    </ul>
  )
}
