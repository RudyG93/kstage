'use client'

// Détecte l'arrivée depuis un push (`?src=push`, posé par withPushSrc sur les
// URLs de notification) : émet `notification_opened` puis nettoie l'URL via
// replaceState (pas de re-render, pas d'entrée d'historique). Monté une fois
// dans le layout racine.

import { useEffect, useRef } from 'react'
import { sendProductEvent } from './beacon'

export function NotificationOpenTracker() {
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    const url = new URL(window.location.href)
    if (url.searchParams.get('src') !== 'push') return
    sendProductEvent('notification_opened', { path: url.pathname })
    url.searchParams.delete('src')
    window.history.replaceState(window.history.state, '', url.toString())
  }, [])
  return null
}
