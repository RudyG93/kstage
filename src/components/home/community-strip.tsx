import Link from 'next/link'
import { Avatar } from '@/components/avatar'
import { Panel, PanelHeader } from '@/components/ui/panel'
import type { CommunityActivityItem } from '@/lib/events/community'

const age = (iso: string) => {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Strip communauté (§7.1.7) : 2 lignes max — la discussion complète vit sur la
// fiche MV, la home ne fait qu'ouvrir la porte.
export function CommunityStrip({ items }: { items: CommunityActivityItem[] }) {
  if (items.length === 0) return null
  return (
    <Panel>
      <PanelHeader label="Community" />
      <ul>
        {items.slice(0, 2).map((item, i) => (
          <li key={i} className="border-b last:border-b-0">
            <Link
              href={item.eventSlug ? `/mv/${item.eventSlug}` : '/mvs'}
              className="hover:bg-secondary/60 flex items-center gap-2.5 px-3 py-2 transition-colors"
            >
              <Avatar username={item.username ?? undefined} avatarUrl={item.avatarUrl} size={18} />
              <span className="min-w-0 flex-1 truncate text-xs">
                <span className="font-semibold">@{item.username ?? 'fan'}</span>
                {item.score !== null ? (
                  <span className="text-muted-foreground">
                    {' '}
                    rated {item.eventTitle}{' '}
                    <span className="text-amber tabular font-semibold">{item.score}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground"> on {item.eventTitle}</span>
                )}
                <span className="text-muted-foreground"> — “{item.body}”</span>
              </span>
              <span className="text-faint shrink-0 text-[10px]">{age(item.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
