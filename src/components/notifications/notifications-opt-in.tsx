'use client'

import { useState, useTransition } from 'react'
import { BellIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { IosInstallHint } from '@/components/notifications/ios-install-hint'
import { pushSupported, subscribeToPush } from '@/lib/notifications/subscribe'

/**
 * Étape 2 de l'onboarding (juste après le follow) : le moment où l'intention
 * est la plus forte pour proposer le push — moteur de rétention n°1 du
 * calendrier. Aucune branche ne bloque la sortie du funnel : denied,
 * unsupported (iOS Safari hors PWA → hint d'install) ou erreur → Continue.
 * Ne SSR jamais (monté après interaction) → pushSupported() au render est sûr.
 */
export function NotificationsOptIn({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'denied' | 'failed'>('idle')
  const supported = pushSupported()

  function enable() {
    startTransition(async () => {
      try {
        const result = await subscribeToPush()
        if (result === 'denied') {
          setStatus('denied')
          return
        }
        if (result === 'subscribed') {
          toast.success("Notifications on — we'll ping you before every drop.")
        }
        onDone()
      } catch {
        setStatus('failed')
      }
    })
  }

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <span
          className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full"
          aria-hidden
        >
          <BellIcon className="size-6" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Never miss a drop</h1>
        <p className="text-muted-foreground text-sm">
          Get a push before every comeback, MV and music show of your groups — in your timezone.
        </p>
      </div>

      {supported ? (
        <div className="flex flex-col items-center gap-3">
          {status === 'denied' && (
            <p className="text-muted-foreground text-xs">
              Notifications are blocked in your browser — you can enable them anytime from your
              browser settings, then from your account page.
            </p>
          )}
          {status === 'failed' && (
            <p className="text-muted-foreground text-xs">
              Could not enable notifications right now — you can retry later from your account page.
            </p>
          )}
          {status === 'idle' ? (
            <>
              <Button type="button" onClick={enable} disabled={pending}>
                {pending ? 'Enabling…' : 'Turn on notifications'}
              </Button>
              <button
                type="button"
                onClick={onDone}
                disabled={pending}
                className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
              >
                Later
              </button>
            </>
          ) : (
            <Button type="button" onClick={onDone}>
              Continue
            </Button>
          )}
        </div>
      ) : (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
          {/* iOS Safari hors standalone : le push exige l'install — on guide.
              Autres environnements non supportés : le hint ne rend rien. */}
          <IosInstallHint />
          <Button type="button" onClick={onDone}>
            Continue
          </Button>
        </div>
      )}
    </div>
  )
}
