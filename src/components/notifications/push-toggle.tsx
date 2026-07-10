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
  const [failed, setFailed] = useState(false)
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
      setFailed(false)
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
        setFailed(true)
      }
    })
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          {/* « Push notifications », pas « Daily » : le système couvre digest
              quotidien + hebdo + alertes comeback — le copy sous-vendait le
              hook de rétention au moment de l'opt-in (audit 2026-07-10). */}
          <p className="text-sm font-medium">Push notifications</p>
          <p className="text-muted-foreground text-sm">
            Daily & weekly digests of your upcoming events, plus comeback alerts.
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
      {/* role=alert : ces retours arrivent après une action async sans
          déplacement de focus — sans live region, un lecteur d'écran n'entend
          jamais l'échec (WCAG 4.1.3). */}
      {denied && !enabled && (
        <p role="alert" className="text-muted-foreground mt-3 text-xs">
          Notifications are blocked in your browser settings. Re-enable them for this site to turn
          on push reminders.
        </p>
      )}
      {failed && (
        <p role="alert" className="text-destructive mt-3 text-xs">
          Couldn&apos;t update notifications. Please try again.
        </p>
      )}
    </div>
  )
}
