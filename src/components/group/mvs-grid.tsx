import { MvCard } from './mv-card'
import type { MvEvent } from '@/lib/events/queries'

export type RatingMap = Map<string, { avg: number; count: number }>

/** Grille responsive de MVs (cards `MvCard`). `ratings` optionnel. */
export function MvsGrid({
  mvs,
  ratings,
  timeZone,
}: {
  mvs: MvEvent[]
  ratings?: RatingMap
  timeZone: string
}) {
  if (mvs.length === 0) return null
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {mvs.map((mv) => (
        <li key={mv.id}>
          <MvCard mv={mv} rating={ratings?.get(mv.id)} timeZone={timeZone} />
        </li>
      ))}
    </ul>
  )
}
