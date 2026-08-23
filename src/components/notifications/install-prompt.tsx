'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Download, ShareIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Invite à installer la PWA.
 *
 * Deux chemins, parce que les navigateurs n'offrent pas la même chose :
 *
 * - **iOS Safari** n'expose AUCUNE API d'installation : on ne peut que décrire
 *   le geste. C'est aussi le seul endroit où l'install est OBLIGATOIRE pour
 *   recevoir des notifications (iOS 16.4+).
 * - **Chrome / Edge / Android** émettent `beforeinstallprompt` : là, un bouton
 *   déclenche la vraie boîte de dialogue système. Il n'y en avait aucun —
 *   `beforeinstallprompt` n'apparaissait pas une seule fois dans `src/`, donc
 *   sur desktop et Android l'installation n'était jamais proposée.
 *
 * Un seul composant plutôt qu'une 4ᵉ surface : les trois points de montage
 * existants (home, /account, opt-in notifications) héritent du bouton
 * gratuitement.
 */
const noop = () => () => {}

/** iOS hors standalone : le seul cas qui n'a pas d'API et doit être expliqué. */
function iosNeedsInstall(): boolean {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    ('standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone)) ||
    window.matchMedia('(display-mode: standalone)').matches
  return isIos && !standalone
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const showIosHint = useSyncExternalStore(noop, iosNeedsInstall, () => false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // L'event n'est émis QU'UNE fois et seulement si le navigateur juge l'app
    // installable : on le retient, sinon le geste est perdu à jamais.
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  if (deferred) {
    return (
      <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg border p-3">
        <p className="text-muted-foreground text-xs">
          Install KStage for a full-screen calendar and instant launch.
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void deferred.prompt()
            // Le geste est consommé : le navigateur ne le rejouera pas.
            setDeferred(null)
          }}
        >
          <Download aria-hidden />
          Install
        </Button>
      </div>
    )
  }

  if (!showIosHint) return null

  return (
    <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-xs">
      <ShareIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        To get notifications on iPhone, add KStage to your Home Screen: tap the Share button, then
        &ldquo;Add to Home Screen&rdquo;.
      </span>
    </div>
  )
}
