import { Panel } from '@/components/ui/panel'
import { LinksBar } from './links-bar'

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)

// Stats strip (§7.6.2) : 4 colonnes séparées par hairlines — followers,
// upcoming, avg score, liens sociaux en couleurs de marque.
export function StatsStrip({
  followers,
  upcoming,
  avgScore,
  links,
}: {
  followers: number
  upcoming: number
  avgScore: number | null
  links: Record<string, string> | null
}) {
  return (
    <Panel>
      {/* items-stretch + justify-center par cellule : centrage vertical réel
          quel que soit le contenu (le texte flottait en haut de la rangée). */}
      <div className="grid grid-cols-3 items-stretch divide-x md:grid-cols-4">
        <Cell value={compact(followers)} label="Followers" />
        <Cell value={String(upcoming)} label="Upcoming" />
        <Cell value={avgScore !== null ? avgScore.toFixed(1) : '—'} label="Avg score" />
        <div className="col-span-3 flex min-h-[52px] items-center justify-center gap-1 border-t p-2 md:col-span-1 md:border-t-0">
          <LinksBar links={links} compact />
        </div>
      </div>
    </Panel>
  )
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-h-[52px] flex-col items-center justify-center gap-1 p-2.5">
      <span className="tabular text-base leading-none font-bold">{value}</span>
      <span className="label-data-inline text-faint text-[8px]">{label}</span>
    </div>
  )
}
