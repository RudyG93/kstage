'use client'

// <Link> qui émet un event produit au clic (CTA landing). sendBeacon survit à
// la navigation — pas besoin de retarder le routage.

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { sendProductEvent } from './beacon'
import type { ProductEvent } from '@/lib/analytics/events'

export function TrackedLink({
  event,
  eventProps,
  onClick,
  ...rest
}: ComponentProps<typeof Link> & {
  event: ProductEvent
  eventProps?: Record<string, string>
}) {
  return (
    <Link
      {...rest}
      onClick={(e) => {
        sendProductEvent(event, eventProps)
        onClick?.(e)
      }}
    />
  )
}
