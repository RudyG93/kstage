import type { ReactNode } from 'react'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'

/**
 * Shell 3 colonnes (My groups · contenu · Recent comebacks + discussions) —
 * extrait du patron déjà copié sur home/groups/calendar/mvs, pour ne plus
 * laisser les côtés vides sur les pages groupe/MV/membre (retour Rudy R10).
 * Rails DESKTOP-only (`hidden lg:block`) : sur mobile la page détail garde son
 * propre contenu, sans empiler les rails. `SidebarLeft` (My groups, auth) n'est
 * rendu que si le viewer est connecté (`signedIn`).
 */
export function PageRails({
  signedIn = false,
  children,
}: {
  signedIn?: boolean
  children: ReactNode
}) {
  return (
    // Pas de padding horizontal mobile : les pages détail sont full-bleed
    // (hero groupe, player MV edge-to-edge). Les rails sont desktop-only.
    <div className="mx-auto w-full max-w-[1400px] py-4 md:px-4 md:py-6">
      <div className="flex gap-6">
        {signedIn && (
          <aside className="hidden shrink-0 lg:block lg:w-60">
            <SidebarLeft showFilters={false} />
          </aside>
        )}
        <div className="min-w-0 flex-1">{children}</div>
        <aside className="hidden shrink-0 lg:block lg:w-80">
          <SidebarRight />
        </aside>
      </div>
    </div>
  )
}
