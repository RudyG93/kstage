'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Bouton rond flottant (player MV, bannière groupe §7.6-7.7) : bg page/55 + blur.
export function BackButton({ className }: { className?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Back"
      className={cn(
        'bg-page/55 text-foreground hover:bg-page/75 focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full backdrop-blur-[8px] transition-colors outline-none focus-visible:ring-2',
        className,
      )}
    >
      <ArrowLeftIcon className="size-4" />
    </button>
  )
}
