import { Badge } from '@/components/ui/badge'
import { formatEventDate } from '@/lib/events/date'
import type { MySuggestion } from '@/lib/suggestions/queries'

const STATUS_VARIANT = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
} as const

export function MySuggestions({ suggestions }: { suggestions: MySuggestion[] }) {
  if (suggestions.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">My suggestions</h2>
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{s.title}</p>
              <p className="text-muted-foreground text-xs">
                {s.groups?.name} · {formatEventDate(s.start_at, 'Asia/Seoul')} KST
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
          </li>
        ))}
      </ul>
    </section>
  )
}
