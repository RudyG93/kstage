'use client'

import { useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import { HeartIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { toggleFollow } from '@/lib/follows/actions'
import { cn } from '@/lib/utils'

export function FollowButton({
  groupId,
  initialFollowing,
  isAuthed,
  className,
}: {
  groupId: string
  initialFollowing: boolean
  isAuthed: boolean
  className?: string
}) {
  const [optimistic, setOptimistic] = useOptimistic(initialFollowing)
  const [pending, startTransition] = useTransition()

  if (!isAuthed) {
    return (
      <Link
        href="/login"
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), className)}
      >
        Follow
      </Link>
    )
  }

  function onClick() {
    startTransition(async () => {
      setOptimistic(!optimistic)
      await toggleFollow(groupId, optimistic)
    })
  }

  return (
    <Button
      type="button"
      variant={optimistic ? 'secondary' : 'outline'}
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-pressed={optimistic}
      className={className}
    >
      <HeartIcon className={cn('size-3.5', optimistic && 'fill-current')} aria-hidden />
      {optimistic ? 'Following' : 'Follow'}
    </Button>
  )
}
