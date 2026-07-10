'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { setNotificationPref } from '@/lib/notifications/actions'
import { getExistingSubscription } from '@/lib/notifications/subscribe'

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
  // null = état inconnu (avant le check async) → toggles actifs par défaut,
  // pas de flash « désactivé » pour les abonnés.
  const [subscribed, setSubscribed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void getExistingSubscription().then((sub) => {
      if (!cancelled) setSubscribed(Boolean(sub))
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Sans abonnement push, ces 5 toggles n'ont aucun effet — les manipuler
  // donnait l'impression que « rien ne marche » (audit 2026-07-10).
  const inert = subscribed === false

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
        {inert && (
          <p className="text-muted-foreground text-xs">
            Enable push notifications above first — these preferences take effect once notifications
            are on.
          </p>
        )}
      </div>
      <div className={inert ? 'divide-y border-t opacity-50' : 'divide-y border-t'}>
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
                disabled={pendingType === type || inert}
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
