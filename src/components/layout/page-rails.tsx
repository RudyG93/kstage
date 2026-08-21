import { Suspense, type ReactNode } from 'react'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { RailSkeleton } from '@/components/ui/rail-skeleton'
import { getViewer } from '@/lib/supabase/viewer'

/**
 * Shell 3 colonnes (My groups · contenu · Recent comebacks + discussions) —
 * extrait du patron déjà copié sur home/groups/calendar/mvs, pour ne plus
 * laisser les côtés vides sur les pages détail (retour Rudy R10).
 *
 * Lot F (2026-07-18) : les rails sont AUTO-SUSPENDUS — leur fan-out de
 * requêtes (SidebarLeft : 3 queries ; SidebarRight : 2) ne bloque plus le
 * premier octet des pages. La colonne gauche décide elle-même de son rendu
 * (connecté seulement) : `getViewer()` est mémoïsé par requête, donc déjà
 * résolu quand la page a rendu son contenu — pas de flash de layout.
 */
/**
 * Colonne « My groups », qui décide elle-même de son rendu.
 *
 * Exportée depuis le 2026-08-21 : /groups, /mvs et /calendar montaient
 * `SidebarLeft` dans leur PROPRE `<aside>`, hors de ce gate. Un visiteur
 * déconnecté recevait donc un panneau mort — « You don't follow any groups
 * yet. · 0 groups · 0 upcoming » — vérifié en prod sur les trois pages, et
 * visible aussi en mobile puisque leur aside n'est pas `hidden`. Le gate doit
 * POSSÉDER l'aside, sinon la colonne réserve sa largeur pour du vide.
 *
 * `className` reste paramétrable : les pages hub gardent leur ordre mobile
 * (`order-2 lg:order-1`), les pages détail leur variante desktop-only.
 */
export async function LeftRail({
  className = 'hidden shrink-0 lg:block lg:w-60',
  groupFilter,
  showFilters = false,
}: {
  className?: string
  groupFilter?: ReactNode
  showFilters?: boolean
}) {
  const { user } = await getViewer()
  if (!user) return null
  return (
    <aside className={className}>
      <SidebarLeft groupFilter={groupFilter} showFilters={showFilters} />
    </aside>
  )
}

export function PageRails({ right, children }: { right?: ReactNode; children: ReactNode }) {
  return (
    // Pas de padding horizontal mobile : les pages détail sont full-bleed
    // (hero groupe, player MV edge-to-edge). Les rails sont desktop-only.
    <div className="mx-auto w-full max-w-[1400px] py-4 md:px-4 md:py-6">
      <div className="flex gap-6">
        <Suspense fallback={null}>
          <LeftRail />
        </Suspense>
        <div className="min-w-0 flex-1">{children}</div>
        <aside className="hidden shrink-0 lg:block lg:w-80">
          <Suspense fallback={<RailSkeleton />}>{right ?? <SidebarRight />}</Suspense>
        </aside>
      </div>
    </div>
  )
}
