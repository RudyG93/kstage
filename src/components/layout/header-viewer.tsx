import Link from 'next/link'
import { BellIcon } from 'lucide-react'
import { AuthMenu } from '@/components/auth/auth-menu'
import { getViewer } from '@/lib/supabase/viewer'

/**
 * Cluster user du header (cloche → réglages notifs + menu compte) — le SEUL
 * morceau du shell qui dépend du viewer. Async sous <Suspense> (Lot F
 * 2026-07-18) : le layout racine redevient synchrone et le chrome statique
 * n'attend plus l'auth — forme requise par cacheComponents (Lot I).
 */
export async function HeaderViewer() {
  const { user, profile } = await getViewer()
  return (
    <>
      {user && (
        <Link
          href="/account"
          aria-label="Notification settings"
          className="text-muted-foreground hover:text-foreground relative shrink-0 p-1 transition-colors"
        >
          {/* Pas de dot : il suggérait une notification en attente alors qu'il
              était décoratif (audit UX 2026-07-04). */}
          <BellIcon className="size-[18px]" />
        </Link>
      )}
      <AuthMenu
        email={user?.email ?? null}
        username={profile?.username ?? null}
        avatarUrl={profile?.avatar_url ?? null}
      />
    </>
  )
}
