'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EVENT_TYPE_LABELS, FILTERABLE_EVENT_TYPES } from '@/lib/events/labels'
import type { GroupSummary } from '@/lib/groups/queries'

export function FilterBar({ groups }: { groups: GroupSummary[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentGroup = searchParams.get('group') ?? ''
  const currentType = searchParams.get('type') ?? ''

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
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
        value={currentType ? [currentType] : []}
        onValueChange={(vals) => setParam('type', vals[0] ?? '')}
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
