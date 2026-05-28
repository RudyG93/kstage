import { MemberCard } from './member-card'
import type { MemberSummary } from '@/lib/members/queries'

/**
 * Grille responsive de membres. Caller filtre par status si besoin
 * (section "Members" = active uniquement, section "Former & pre-debut" = autres).
 */
export function MembersGrid({
  members,
  groupColorHex,
}: {
  members: MemberSummary[]
  groupColorHex: string | null
}) {
  if (members.length === 0) return null
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {members.map((m) => (
        <li key={m.id}>
          <MemberCard member={m} groupColorHex={groupColorHex} />
        </li>
      ))}
    </ul>
  )
}
