'use client'

import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SuggestionForm } from './suggestion-form'
import { SuggestFixForm } from './suggest-fix-form'

type Tab = 'new' | 'fix'

export function SuggestEventDialog({
  groups,
  defaultOpen = false,
  triggerClassName,
  triggerLabel = 'Suggest',
}: {
  groups: { id: string; name: string }[]
  defaultOpen?: boolean
  triggerClassName?: string
  triggerLabel?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState<Tab>('new')
  const close = useCallback(() => setOpen(false), [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Suggest an event or a fix"
        className={
          triggerClassName ??
          'border-foreground/15 hover:bg-muted focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium outline-none focus-visible:ring-3'
        }
      >
        <Plus className="size-4" aria-hidden />
        <span className="hidden sm:inline">{triggerLabel}</span>
      </button>

      <DialogContent>
        <DialogTitle>Contribute</DialogTitle>

        <ToggleGroup
          aria-label="Suggestion type"
          value={[tab]}
          onValueChange={(values) => {
            const next = values[0] as Tab | undefined
            if (next === 'new' || next === 'fix') setTab(next)
          }}
          className="mt-2 mb-4"
        >
          <ToggleGroupItem value="new">Suggest new</ToggleGroupItem>
          <ToggleGroupItem value="fix">Suggest fix</ToggleGroupItem>
        </ToggleGroup>

        {tab === 'new' ? (
          <SuggestionForm groups={groups} onSuccess={close} />
        ) : (
          <SuggestFixForm onSuccess={close} />
        )}
      </DialogContent>
    </Dialog>
  )
}
