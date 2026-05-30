'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EVENT_TYPE_LABELS, FILTERABLE_EVENT_TYPES } from '@/lib/events/labels'
import { parseTypesParam, serializeTypesParam } from '@/lib/events/filters'
import type { GroupSummary } from '@/lib/groups/queries'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

export function FilterBar({ groups }: { groups: GroupSummary[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentGroup = searchParams.get('group') ?? ''
  const currentTypes = parseTypesParam(searchParams.get('type') ?? undefined)

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function setTypes(values: string[]) {
    const filtered = values.filter((v): v is EventType =>
      (FILTERABLE_EVENT_TYPES as readonly string[]).includes(v),
    )
    setParam('type', serializeTypesParam(filtered))
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        aria-label="Filter by group"
        value={currentGroup}
        onChange={(e) => setParam('group', e.target.value)}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
      >
        <option value="">All groups</option>
        {groups.map((g) => (
          <option key={g.slug} value={g.slug}>
            {g.name}
          </option>
        ))}
      </select>

      <ToggleGroup
        role="toolbar"
        aria-label="Filter by type"
        variant="outline"
        multiple
        value={currentTypes}
        onValueChange={setTypes}
      >
        {FILTERABLE_EVENT_TYPES.map((t) => (
          <ToggleGroupItem
            key={t}
            value={t}
            className="font-mono text-[11px] tracking-wide uppercase"
          >
            {EVENT_TYPE_LABELS[t]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
