'use client'

// Event « vue » déclenché au MONTAGE CLIENT effectif — jamais en side-effect
// RSC : le prefetch des <Link> re-rend les RSC sans visite réelle et
// gonflerait la north-star. Ref-guard : le double-invoke des effects en dev
// (StrictMode) n'envoie qu'une fois.

import { useEffect, useRef } from 'react'
import { sendProductEvent } from './beacon'
import type { ProductEvent } from '@/lib/analytics/events'

export function TrackView({
  event,
  props,
}: {
  event: ProductEvent
  props?: Record<string, string>
}) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    sendProductEvent(event, props)
    // props volontairement hors deps : un event de vue s'envoie une seule
    // fois par montage, pas à chaque re-render du parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])
  return null
}
