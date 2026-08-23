import { Panel } from '@/components/ui/panel'
import { LinksBar } from './links-bar'

/**
 * Stats strip (§7.6.2) — cellules VARIABLES séparées par hairlines.
 *
 * Elle rendait 3 cellules fixes, dont deux structurellement mortes : 208 des
 * 260 artistes sont à 0 follower et la base porte 2 notes en tout. La page
 * Seventeen affichait donc « 0 Followers · — Avg score », c'est-à-dire une
 * anti-preuve sociale sur les plus gros groupes du roster — exactement ce que
 * le BACKLOG interdit pour les features gelées, jamais appliqué au livré.
 *
 * L'appelant ne passe donc que les cellules qui ont une valeur. Rien n'est
 * supprimé : elles reviennent d'elles-mêmes le jour où il y a du monde.
 */
export interface StatCell {
  value: string
  label: string
}

/** Au-delà, la rangée devient illisible et les liens n'ont plus de place. */
export const MAX_CELLS = 3

// Tailwind ne voit pas les classes construites à l'exécution : on les énumère.
//
// Deux axes distincts, et c'est le piège : en MOBILE une colonne par cellule
// (le bloc liens passe à la ligne via SPAN), en `md:` une colonne par enfant
// RÉELLEMENT rendu. Indexer le `md:` sur le nombre de cellules réservait une
// colonne aux liens même quand le groupe n'en a aucun — 7 groupes publiés ont
// `links = '{}'` et affichaient un panneau à moitié vide.
const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
}
const MD_COLS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
}
const SPAN: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
}

export function StatsStrip({
  stats,
  links,
}: {
  stats: StatCell[]
  links: Record<string, string> | null
}) {
  const cells = stats.slice(0, MAX_CELLS)
  const hasLinks = links && Object.keys(links).length > 0
  if (cells.length === 0 && !hasLinks) return null
  const total = cells.length + (hasLinks ? 1 : 0)
  return (
    <Panel>
      {/* items-stretch + justify-center par cellule : centrage vertical réel
          quel que soit le contenu (le texte flottait en haut de la rangée). */}
      <div
        className={`grid items-stretch divide-x ${COLS[cells.length] ?? 'grid-cols-1'} ${
          MD_COLS[total] ?? 'md:grid-cols-4'
        }`}
      >
        {cells.map((c) => (
          <Cell key={c.label} value={c.value} label={c.label} />
        ))}
        {hasLinks && (
          <div
            className={`flex min-h-[52px] items-center justify-center gap-1 p-2 ${
              cells.length > 0 ? `${SPAN[cells.length]} border-t md:col-span-1 md:border-t-0` : ''
            }`}
          >
            <LinksBar links={links} compact />
          </div>
        )}
      </div>
    </Panel>
  )
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-h-[52px] flex-col items-center justify-center gap-1 p-2.5">
      <span className="tabular text-base leading-none font-bold">{value}</span>
      <span className="label-data-inline text-faint text-[9px]">{label}</span>
    </div>
  )
}
