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
  iconOnly = false,
}: {
  groupId: string
  initialFollowing: boolean
  isAuthed: boolean
  className?: string
  // Variante cœur-seul pour les cards en overlay sur image (§3.4).
  iconOnly?: boolean
}) {
  const [optimistic, setOptimistic] = useOptimistic(initialFollowing)
  const [pending, startTransition] = useTransition()

  // Bouton rond cœur-seul posé sur l'image : fond sombre translucide pour le
  // contraste, cœur rempli rouge si suivi, contour blanc sinon.
  const iconClass =
    'flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition hover:bg-black/60 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none'

  if (!isAuthed) {
    if (iconOnly) {
      return (
        <Link href="/login" aria-label="Follow" className={cn(iconClass, className)}>
          <HeartIcon className="size-5 text-white" aria-hidden />
        </Link>
      )
    }
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

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={optimistic}
        aria-label={optimistic ? 'Unfollow' : 'Follow'}
        className={cn(iconClass, className)}
      >
        <HeartIcon
          className={cn('size-5', optimistic ? 'fill-red-500 text-red-500' : 'text-white')}
          aria-hidden
        />
      </button>
    )
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
