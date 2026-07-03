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
  large = false,
  pill = false,
}: {
  groupId: string
  initialFollowing: boolean
  isAuthed: boolean
  className?: string
  // Variante cœur-seul pour les cards en overlay sur image (§3.4).
  iconOnly?: boolean
  // Variante agrandie (bandeau page artiste §3.5).
  large?: boolean
  // Variante pilule Data Desk (bannière groupe §7.6.1) : FOLLOW = encre pleine,
  // FOLLOWING = outline rose + cœur rempli.
  pill?: boolean
}) {
  const [optimistic, setOptimistic] = useOptimistic(initialFollowing)
  const [pending, startTransition] = useTransition()

  const pillClass = cn(
    'label-data-inline inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[9px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    optimistic
      ? 'border border-rose/50 text-rose bg-page/40 backdrop-blur-sm'
      : 'bg-foreground text-background',
  )

  // Bouton rond cœur-seul posé sur l'image : fond sombre translucide pour le
  // contraste, cœur rempli rouge si suivi, contour blanc sinon.
  const iconClass = cn(
    'flex cursor-pointer items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition hover:bg-black/60 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none',
    large ? 'size-12' : 'size-9',
  )
  const heartSize = large ? 'size-6' : 'size-5'

  if (!isAuthed) {
    if (pill) {
      return (
        <Link href="/login" className={cn(pillClass, className)}>
          <HeartIcon className="size-3" aria-hidden />
          Follow
        </Link>
      )
    }
    if (iconOnly) {
      return (
        <Link href="/login" aria-label="Follow" className={cn(iconClass, className)}>
          <HeartIcon className={cn(heartSize, 'text-white')} aria-hidden />
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

  if (pill) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={optimistic}
        className={cn(pillClass, className)}
      >
        <HeartIcon className={cn('size-3', optimistic && 'fill-current')} aria-hidden />
        {optimistic ? 'Following' : 'Follow'}
      </button>
    )
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
          className={cn(heartSize, optimistic ? 'fill-red-500 text-red-500' : 'text-white')}
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
