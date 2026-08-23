import type { Route } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Trophy } from 'lucide-react'
import { faceCrop } from '@/lib/images/cloudinary'

/**
 * « Winner — Stray Kids, This & That (16th win) ».
 *
 * Le rang vient de Wikipedia, PAS d'un comptage maison : notre base ne couvre
 * que quelques mois de passages, un cumul calculé chez nous serait faux et
 * paraîtrait sourcé. On affiche donc ce que la page dit, et rien d'autre.
 *
 * `groupSlug` est null quand le nom ne correspond à aucun groupe du roster
 * (collaboration à trois, soliste absent, groupe d'une autre époque) : on
 * affiche alors le nom brut, sans lien mort.
 */
export function WinnerBanner({
  name,
  song,
  nth,
  groupSlug,
  groupImage,
}: {
  name: string
  song: string | null
  nth: number | null
  groupSlug: string | null
  groupImage: string | null
}) {
  const ordinal = nth ? `${nth}${suffix(nth)} win` : null
  const body = (
    <>
      {groupImage ? (
        <Image
          src={faceCrop(groupImage, 72, 72)}
          alt=""
          width={36}
          height={36}
          unoptimized
          className="size-9 shrink-0 rounded-lg object-cover"
          aria-hidden
        />
      ) : (
        <span
          className="bg-amber/15 text-amber flex size-9 shrink-0 items-center justify-center rounded-lg"
          aria-hidden
        >
          <Trophy className="size-4" strokeWidth={2} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="label-data-inline text-amber block text-[9px]">Winner</span>
        <span className="block truncate text-sm font-semibold">
          {name}
          {song && <span className="text-muted-foreground font-normal"> — {song}</span>}
        </span>
      </span>
      {ordinal && (
        <span className="tabular text-muted-foreground shrink-0 text-[11px] font-semibold">
          {ordinal}
        </span>
      )}
    </>
  )

  const className = 'border-amber/25 bg-amber/[0.06] flex items-center gap-3 rounded-lg border p-3'

  if (!groupSlug) return <div className={className}>{body}</div>
  return (
    <Link
      href={`/groups/${groupSlug}` as Route}
      className={`${className} hover:border-amber/50 transition-colors`}
    >
      {body}
    </Link>
  )
}

/** 1st, 2nd, 3rd, 4th… — 11/12/13 font exception. */
function suffix(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  const mod10 = n % 10
  return mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th'
}
