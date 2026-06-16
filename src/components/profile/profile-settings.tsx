import Link from 'next/link'
import { Settings } from 'lucide-react'
import { IosInstallHint } from '@/components/notifications/ios-install-hint'
import { PushToggle } from '@/components/notifications/push-toggle'
import { MySuggestions } from '@/components/suggestions/my-suggestions'
import { buttonVariants } from '@/components/ui/button'
import type { MySuggestion } from '@/lib/suggestions/queries'

// Réglages propres au profil (owner) : notifications, admin, suggestions, lien
// vers les réglages de compte. Récupère les anciennes fonctions de /my (§3.8).
export function ProfileSettings({
  admin,
  pendingCount,
  suggestions,
}: {
  admin: boolean
  pendingCount: number
  suggestions: MySuggestion[]
}) {
  return (
    <div className="bg-card border-border shadow-soft space-y-4 rounded-2xl border p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Settings</h2>
        <div className="flex items-center gap-2">
          {admin && (
            <>
              <Link
                href="/admin/suggestions"
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                Admin{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Link>
              <Link
                href="/admin/reports"
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                Reports
              </Link>
            </>
          )}
          <Link href="/account" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Settings className="size-4" />
            Account
          </Link>
        </div>
      </div>

      <IosInstallHint />
      <PushToggle />
      <MySuggestions suggestions={suggestions} />
    </div>
  )
}
