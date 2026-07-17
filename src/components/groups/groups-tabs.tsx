'use client'

import { useState } from 'react'
import { GroupCard } from '@/components/group-card'
import { GroupsGrid, type GroupGridItem } from '@/components/groups-grid'
import { GroupSort } from '@/components/home/group-sort'
import { TrendingList, type TrendingEntry } from '@/components/group/trending-list'
import { cn } from '@/lib/utils'

export type TabKey = 'groups' | 'solo'

export interface GroupsTabData {
  followedItems: GroupGridItem[]
  trendingEntries: TrendingEntry[]
  items: GroupGridItem[]
  /** « groups » / « soloists » — libellé du compteur « All … — N ». */
  countNoun: string
}

/**
 * Bascule Groups/Solo 100 % client (retour Rudy 2026-07-17 : les onglets
 * `<Link ?tab=>` re-rendaient toute la page serveur → switch lent). Le RSC
 * précharge les DEUX jeux de données ; ici on ne fait que choisir lequel
 * afficher — même philosophie que la recherche de GroupsGrid et le tri des
 * commentaires. L'URL reste sync (deep-link partageable) via replaceState,
 * sans round-trip ni entrée d'historique par clic.
 */
export function GroupsTabs({
  initialTab,
  sort,
  timeZone,
  isAuthed,
  tabs,
}: {
  initialTab: TabKey
  sort: string
  timeZone: string
  isAuthed: boolean
  tabs: Record<TabKey, GroupsTabData>
}) {
  const [tab, setTab] = useState<TabKey>(initialTab)
  const data = tabs[tab]

  const select = (next: TabKey) => {
    setTab(next)
    const params = new URLSearchParams(window.location.search)
    if (next === 'solo') params.set('tab', 'solo')
    else params.delete('tab')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `/groups?${qs}` : '/groups')
  }

  return (
    <div className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-[17px] font-extrabold tracking-[-0.01em]">Groups</h1>
        <div className="flex items-center gap-2">
          <nav
            aria-label="Filter by kind"
            className="bg-secondary inline-flex gap-0.5 rounded-md border p-0.5"
          >
            <SegmentButton active={tab === 'groups'} onClick={() => select('groups')}>
              Groups
            </SegmentButton>
            <SegmentButton active={tab === 'solo'} onClick={() => select('solo')}>
              Solo
            </SegmentButton>
          </nav>
          <GroupSort value={sort} />
        </div>
      </div>

      {data.followedItems.length > 0 && (
        <section className="space-y-2">
          <span className="label-data">Following — {data.followedItems.length}</span>
          <div className="grid grid-cols-2 gap-[9px] md:grid-cols-3">
            {data.followedItems.map((item) => (
              <GroupCard key={item.group.slug} {...item} timeZone={timeZone} />
            ))}
          </div>
        </section>
      )}

      <TrendingList entries={data.trendingEntries} isAuthed={isAuthed} />

      <section className="space-y-2">
        <span className="label-data">
          All {data.countNoun} — {data.items.length}
        </span>
        <GroupsGrid items={data.items} timeZone={timeZone} />
      </section>
    </div>
  )
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'label-data-inline focus-visible:ring-ring/50 cursor-pointer rounded-sm px-2.5 py-1.5 text-[9px] transition-colors outline-none focus-visible:ring-2',
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
