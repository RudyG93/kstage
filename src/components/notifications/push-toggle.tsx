'use client'

import { useEffect, useState, useTransition } from 'react'
import { BellIcon, BellOffIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getExistingSubscription,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/notifications/subscribe'

export function PushToggle() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [denied, setDenied] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const sub = await getExistingSubscription()
      if (cancelled) return
      const sup = pushSupported()
      setSupported(sup)
      setEnabled(Boolean(sub))
      if (sup && Notification.permission === 'denied') setDenied(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (supported === null) return null

  function onToggle() {
    startTransition(async () => {
      setErrorMsg(null)
      try {
        if (enabled) {
          await unsubscribeFromPush()
          setEnabled(false)
          return
        }
        const result = await subscribeToPush()
        if (result === 'denied') {
          setDenied(true)
          return
        }
        if (result === 'subscribed') {
          setEnabled(true)
          setDenied(false)
        }
      } catch (err) {
        console.error('[push] subscribe failed', err)
        setErrorMsg(err instanceof Error ? err.message : String(err))
      }
    })
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Daily notifications</p>
          <p className="text-muted-foreground text-sm">
            Get a daily push with your upcoming events.
          </p>
        </div>
        {supported ? (
          <Button
            type="button"
            variant={enabled ? 'secondary' : 'default'}
            size="sm"
            onClick={onToggle}
            disabled={pending}
            aria-pressed={enabled}
          >
            {enabled ? <BellOffIcon aria-hidden /> : <BellIcon aria-hidden />}
            {enabled ? 'Disable' : 'Enable'}
          </Button>
        ) : (
          <span className="text-muted-foreground text-sm">Not supported</span>
        )}
      </div>
      {denied && !enabled && (
        <p className="text-muted-foreground mt-3 text-xs">
          Notifications are blocked in your browser settings. Re-enable them for this site to turn
          on daily reminders.
        </p>
      )}
      {errorMsg && (
        <p className="text-destructive mt-3 text-xs">
          Couldn&apos;t update notifications: {errorMsg}
        </p>
      )}
    </div>
  )
}
