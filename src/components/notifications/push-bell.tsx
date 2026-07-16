'use client'

import { useEffect, useState, useTransition } from 'react'
import { BellIcon, BellOffIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  getExistingSubscription,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/notifications/subscribe'
import { cn } from '@/lib/utils'

// Cloche compacte (header profil) : active/désactive les notifs push. La version
// détaillée (explication + hint iOS) vit sur /account.
export function PushBell() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const sub = await getExistingSubscription()
      if (cancelled) return
      setSupported(pushSupported())
      setEnabled(Boolean(sub))
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
        'hover:bg-muted/50 focus-visible:ring-ring/50 inline-flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 disabled:opacity-50',
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
