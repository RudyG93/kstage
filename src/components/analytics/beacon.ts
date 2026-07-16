'use client'

// Envoi client d'un event produit vers /api/e — sendBeacon (survit à la
// navigation, ex. clic CTA) avec repli fetch keepalive. Best-effort : jamais
// d'erreur remontée à l'UI.

import type { ProductEvent } from '@/lib/analytics/events'

export function sendProductEvent(event: ProductEvent, props?: Record<string, string>): void {
  try {
    const body = JSON.stringify({ event, props })
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      if (navigator.sendBeacon('/api/e', body)) return
    }
    void fetch('/api/e', { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // no-op : l'analytics ne casse jamais l'UI.
  }
}
