'use client'

import { useSyncExternalStore } from 'react'
import { ShareIcon } from 'lucide-react'

// iOS n'autorise le push que sur une PWA installée (iOS 16.4+).
// On guide donc l'install uniquement sur Safari iOS hors mode standalone.
const noop = () => () => {}

function getSnapshot(): boolean {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    ('standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone)) ||
    window.matchMedia('(display-mode: standalone)').matches
  return isIos && !standalone
}

export function IosInstallHint() {
  const show = useSyncExternalStore(noop, getSnapshot, () => false)

  if (!show) return null

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
