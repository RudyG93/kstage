'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { updateEventTitle, setEventHidden } from '@/lib/events/actions'

export type AdminEvent = {
  id: string
  title: string
  type: string
  start_at: string
  hidden: boolean
  group: string
}

/** Liste d'events admin : corriger le titre + masquer/ré-afficher (faux event). */
export function EventAdminList({ events }: { events: AdminEvent[] }) {
  if (events.length === 0) {
    return <p className="text-muted-foreground px-1 py-3 text-sm">Aucun résultat.</p>
  }
  return (
    <ul className="divide-y rounded-xl border">
      {events.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
    </ul>
  )
}

function EventRow({ event }: { event: AdminEvent }) {
  const [title, setTitle] = useState(event.title)
  const [saved, setSaved] = useState(event.title)
  const [hidden, setHidden] = useState(event.hidden)
  const [pending, startTransition] = useTransition()

  const dirty = title.trim() !== saved && title.trim().length > 0
  const date = new Date(event.start_at).toISOString().slice(0, 10)

  function saveTitle() {
    if (!dirty) return
    startTransition(async () => {
      const res = await updateEventTitle(event.id, title)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setSaved(title.trim())
      toast.success('Titre mis à jour')
    })
  }

  function toggleHidden() {
    startTransition(async () => {
      const next = !hidden
      const res = await setEventHidden(event.id, next)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setHidden(next)
      toast.success(next ? 'Event masqué' : 'Event ré-affiché')
    })
  }

  return (
    <li className={`space-y-1.5 px-3 py-2.5 ${hidden ? 'opacity-60' : ''}`}>
      <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
        <span className="label-data-inline">{event.type}</span>
        <span className="tabular">{date}</span>
        <span className="truncate">{event.group}</span>
        {hidden && <span className="text-destructive">· masqué</span>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-input bg-background focus-visible:ring-ring/50 h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-2"
        />
        <Button type="button" size="sm" onClick={saveTitle} disabled={pending || !dirty}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant={hidden ? 'outline' : 'ghost'}
          onClick={toggleHidden}
          disabled={pending}
        >
          {hidden ? 'Unhide' : 'Hide'}
        </Button>
      </div>
    </li>
  )
}
