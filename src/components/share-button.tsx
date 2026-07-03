'use client'

import { ShareIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Partage natif (navigator.share) avec repli copie du lien (§7.6.1).
export function ShareButton({ title, className }: { title: string; className?: string }) {
  async function onShare() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      }
    } catch {
      // partage annulé — rien à faire
    }
  }
  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Share"
      className={cn(
        'bg-page/55 text-foreground hover:bg-page/75 focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full backdrop-blur-[8px] transition-colors outline-none focus-visible:ring-2',
        className,
      )}
    >
      <ShareIcon className="size-4" />
    </button>
  )
}
