'use client'

import { useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import { HeartIcon } from 'lucide-react'
import { toast } from 'sonner'
import { toggleFollow } from '@/lib/follows/actions'
import { cn } from '@/lib/utils'

// CTA du hero NEXT UP : suivre le groupe uniquement. Les permissions, abonnements
// et préférences push restent une capacité séparée dans Account.
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

  const pillClass = cn(
    'label-data-inline inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[9px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    optimistic
      ? 'border-primary/40 text-primary border bg-transparent'
      : 'bg-foreground text-background',
  )

  if (!isAuthed) {
    return (
      <Link href="/login" className={pillClass}>
        <HeartIcon className="size-3" aria-hidden />
        Follow
      </Link>
    )
  }

  function onClick() {
    const wasFollowing = optimistic

    startTransition(async () => {
      setOptimistic(!wasFollowing)
      try {
        await toggleFollow(groupId, wasFollowing)
      } catch {
        toast.error("Couldn't update follow — please try again.")
      }
    })
  }

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic}
      onClick={onClick}
      className={cn(pillClass, 'disabled:opacity-60')}
    >
      <HeartIcon className={cn('size-3', optimistic && 'fill-current')} aria-hidden />
      {optimistic ? 'Following' : 'Follow'}
    </button>
  )
}
