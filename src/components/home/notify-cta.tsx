'use client'

import { useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import { BellIcon, BellRingIcon } from 'lucide-react'
import { toggleFollow } from '@/lib/follows/actions'
import { cn } from '@/lib/utils'

// CTA du hero NEXT UP (§7.1.3). Mapping produit : suivre le groupe = armer les
// push datés (announced/J-1/jour-J). Déjà suivi → lien vers les réglages notifs.
export function NotifyCta({
  groupId,
  initialFollowing,
  isAuthed,
}: {
  groupId: string
  initialFollowing: boolean
  isAuthed: boolean
}) {
  const [optimistic, setOptimistic] = useOptimistic(initialFollowing)
  const [pending, startTransition] = useTransition()

  const pillClass =
    'label-data-inline inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[9px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

  if (!isAuthed) {
    return (
      <Link href="/login" className={cn(pillClass, 'bg-foreground text-background')}>
        <BellIcon className="size-3" aria-hidden />
        Notify me
      </Link>
    )
  }

  if (optimistic) {
    return (
      <Link
        href="/account"
        className={cn(pillClass, 'border-primary/40 text-primary border bg-transparent')}
      >
        <BellRingIcon className="size-3" aria-hidden />
        Notify is on
      </Link>
    )
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(true)
          await toggleFollow(groupId, false)
        })
      }
      className={cn(pillClass, 'bg-foreground text-background disabled:opacity-60')}
    >
      <BellIcon className="size-3" aria-hidden />
      Notify me
    </button>
  )
}
