'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { setNotificationPref } from '@/lib/notifications/actions'

const PREF_ROWS = [
  { type: 'mv', label: 'MV drops', hint: 'New music videos from your groups' },
  { type: 'release', label: 'Releases', hint: 'Album & single release dates' },
  { type: 'music_show', label: 'Music shows', hint: 'Music Bank, Inkigayo… lineups' },
  { type: 'anniversary', label: 'Birthdays & anniversaries', hint: 'Member birthdays, debut days' },
  { type: 'live', label: 'Lives', hint: 'Scheduled premieres and lives' },
] as const

/**
 * Préférences par type d'event (free : on/off — les lead-times custom sont
 * réservés à un futur premium). Absence de préférence = activé. État
 * optimiste avec rollback si l'upsert échoue.
 */
export function NotificationPrefs({ initial }: { initial: Record<string, boolean> }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initial)
  const [pendingType, setPendingType] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function toggle(type: string) {
    const next = !(prefs[type] ?? true)
    setPrefs((p) => ({ ...p, [type]: next }))
    setPendingType(type)
    startTransition(async () => {
      try {
        await setNotificationPref(type, next)
      } catch {
        setPrefs((p) => ({ ...p, [type]: !next }))
        toast.error('Could not save your preference. Please try again.')
      } finally {
        setPendingType(null)
      }
    })
  }

  return (
    <div className="rounded-lg border">
      <div className="space-y-0.5 p-4 pb-3">
        <p className="text-sm font-medium">What to get pushed about</p>
        <p className="text-muted-foreground text-sm">
          Applies to your daily & weekly digests and comeback alerts.
        </p>
      </div>
      <div className="divide-y border-t">
        {PREF_ROWS.map(({ type, label, hint }) => {
          const on = prefs[type] ?? true
          return (
            <div key={type} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm">{label}</p>
                <p className="text-muted-foreground truncate text-xs">{hint}</p>
              </div>
              <Button
                type="button"
                variant={on ? 'default' : 'secondary'}
                size="sm"
                onClick={() => toggle(type)}
                disabled={pendingType === type}
                aria-pressed={on}
                aria-label={`${label} notifications ${on ? 'on' : 'off'}`}
                className="w-14 shrink-0"
              >
                {on ? 'On' : 'Off'}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
