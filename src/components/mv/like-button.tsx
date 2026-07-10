'use client'

import { useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import { HeartIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { toggleLike } from '@/lib/events/like-actions'
import { cn } from '@/lib/utils'

// Like binaire d'un MV (distinct du vote 1-10). Optimistic sur l'état + le compteur.
export function LikeButton({
  eventId,
  initialLiked,
  count,
  isAuthed,
}: {
  eventId: string
  initialLiked: boolean
  count: number
  isAuthed: boolean
}) {
  const [optimistic, setOptimistic] = useOptimistic({ liked: initialLiked, count })
  const [pending, startTransition] = useTransition()

  // Cœur seul + compteur (le mot « Like » était redondant). a11y via aria-label.
  if (!isAuthed) {
    return (
      <Link
        href="/login"
        aria-label="Like"
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
      >
        <HeartIcon className="size-4" aria-hidden />
        {count > 0 ? count : ''}
      </Link>
    )
  }

  function onClick() {
    startTransition(async () => {
      setOptimistic({
        liked: !optimistic.liked,
        count: optimistic.count + (optimistic.liked ? -1 : 1),
      })
      await toggleLike(eventId, optimistic.liked)
    })
  }

  return (
    <Button
      type="button"
      variant={optimistic.liked ? 'secondary' : 'outline'}
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? 'Unlike' : 'Like'}
    >
      <HeartIcon className={cn('size-4', optimistic.liked && 'fill-live text-live')} aria-hidden />
      {optimistic.count > 0 ? optimistic.count : ''}
    </Button>
  )
}
