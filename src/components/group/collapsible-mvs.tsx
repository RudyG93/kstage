'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MvsGrid, type RatingMap } from './mvs-grid'
import type { MvEvent } from '@/lib/events/queries'

const INITIAL = 15

// Affiche les 15 derniers MV ; « Show all » déplie le reste (§3.5).
export function CollapsibleMvs({
  mvs,
  ratings,
  timeZone,
}: {
  mvs: MvEvent[]
  ratings?: RatingMap
  timeZone: string
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? mvs : mvs.slice(0, INITIAL)

  return (
    <div className="space-y-3">
      <MvsGrid mvs={shown} ratings={ratings} timeZone={timeZone} />
      {mvs.length > INITIAL && !expanded && (
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
          Show all {mvs.length}
        </Button>
      )}
    </div>
  )
}
