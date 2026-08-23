'use client'

import { useEffect, useState } from 'react'
import { isPushEndpointRegistered, savePushSubscription } from './actions'
import { getExistingSubscription, pushSupported } from './subscribe'

/**
 * État d'abonnement push RÉCONCILIÉ entre le navigateur et la base.
 *
 * Les deux surfaces d'opt-in (cloche du profil, toggle de /account) lisaient
 * uniquement `pushManager.getSubscription()`. Constaté en prod le 2026-08-23 :
 * `push_subscriptions` était vide pendant que le bouton affichait « Disable ».
 * Un abonnement navigateur sans ligne en base ne reçoit RIEN, et l'interface
 * affirmait le contraire.
 *
 * Quand l'écart est détecté, on tente UN rattrapage — pas un par montage : la
 * server action est plafonnée à 20 enregistrements/24 h, une boucle brûlerait
 * le quota en vingt navigations. Si le rattrapage échoue, on affiche l'état
 * RÉEL (désabonné) plutôt que de mentir dans l'autre sens.
 */
export function usePushState() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(false)
  /** Permission refusée au niveau du navigateur : aucun opt-in n'aboutira. */
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const sup = pushSupported()
      if (cancelled) return
      setSupported(sup)
      if (!sup) return
      if (Notification.permission === 'denied') setDenied(true)
      const sub = await getExistingSubscription()
      if (cancelled) return
      if (!sub) {
        setEnabled(false)
        return
      }
      let registered = false
      try {
        registered = await isPushEndpointRegistered(sub.endpoint)
        if (!registered) {
          const keys = sub.toJSON().keys
          if (keys?.p256dh && keys.auth) {
            await savePushSubscription({
              endpoint: sub.endpoint,
              p256dh: keys.p256dh,
              auth: keys.auth,
              userAgent: navigator.userAgent,
            })
            registered = true
          }
        }
      } catch (err) {
        // Rate limit atteint, réseau coupé, session expirée : on n'invente pas
        // un état « activé » que la base ne confirme pas.
        console.error('[push] reconciliation failed', err)
      }
      if (!cancelled) setEnabled(registered)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { supported, enabled, denied, setEnabled, setDenied }
}
