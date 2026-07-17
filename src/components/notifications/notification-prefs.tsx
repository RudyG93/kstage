'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { setNotificationPref } from '@/lib/notifications/actions'
import { getExistingSubscription } from '@/lib/notifications/subscribe'
import { DIGEST_SEND_UTC } from '@/lib/notifications/prefs'
import { useHydrated } from '@/hooks/use-hydrated'

const PREF_ROWS = [
  { type: 'mv', label: 'MV drops', hint: 'New music videos from your groups' },
  { type: 'release', label: 'Releases', hint: 'Album & single release dates' },
  { type: 'music_show', label: 'Music shows', hint: 'Music Bank, Inkigayo… lineups' },
  { type: 'anniversary', label: 'Birthdays & anniversaries', hint: 'Member birthdays, debut days' },
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

  // Sans abonnement push, ces préférences n'ont aucun effet : les manipuler
  // donnerait l'impression que « rien ne marche ».
  const inert = subscribed === false

  // Heure d'envoi du digest en heure LOCALE du navigateur — calculée après
  // hydratation (pattern LocalTime : le serveur ne connaît pas le fuseau).
  const hydrated = useHydrated()
  let digestLocalTime = ''
  if (hydrated) {
    const d = new Date()
    d.setUTCHours(DIGEST_SEND_UTC.hour, DIGEST_SEND_UTC.minute, 0, 0)
    digestLocalTime = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d)
  }

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
        {/* Les 2 flux expliqués (retour Rudy 2026-07-17 : « daily digest /
            weekly digest / comeback alert » étaient nommés sans être définis). */}
        <p className="text-muted-foreground text-sm">
          You get at most two kinds of pushes: a <strong>daily digest</strong> — one summary of your
          groups&apos; next 48 hours{digestLocalTime ? `, around ${digestLocalTime}` : ''} (Mondays
          it covers the whole week) — and <strong>comeback alerts</strong>, sent the day before a
          drop and once it&apos;s out. These toggles pick which event types appear in them.
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
