'use client'

import { useTransition } from 'react'
import { BellIcon, BellOffIcon } from 'lucide-react'
import { toast } from 'sonner'
import { subscribeToPush, unsubscribeFromPush } from '@/lib/notifications/subscribe'
import { usePushState } from '@/lib/notifications/use-push-state'
import { cn } from '@/lib/utils'

// Cloche compacte (header profil) : active/désactive les notifs push. La version
// détaillée (explication + hint iOS) vit sur /account.
export function PushBell() {
  // Même état réconcilié que /account : la cloche ne doit pas dire « activé »
  // quand la base n'a aucune ligne pour cet endpoint.
  const { supported, enabled, setEnabled } = usePushState()
  const [pending, startTransition] = useTransition()

  if (!supported) return null

  function onToggle() {
    startTransition(async () => {
      try {
        if (enabled) {
          await unsubscribeFromPush()
          setEnabled(false)
          return
        }
        const result = await subscribeToPush('profile')
        if (result === 'denied') {
          toast.error('Notifications are blocked in your browser settings.')
          return
        }
        if (result === 'subscribed') setEnabled(true)
      } catch {
        toast.error("Couldn't update notifications. Please try again.")
      }
    })
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={enabled}
      aria-label={enabled ? 'Disable notifications' : 'Enable notifications'}
      className={cn(
        'hover:bg-hover focus-visible:ring-ring/50 inline-flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 disabled:opacity-50',
        enabled ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {enabled ? (
        <BellIcon className="size-5" aria-hidden />
      ) : (
        <BellOffIcon className="size-5" aria-hidden />
      )}
    </button>
  )
}
