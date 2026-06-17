'use client'

import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/utils'

// Bascule en pilule à knob (maquette KStage Home) : soleil à gauche en Daylight,
// lune à droite en Midnight, le knob glisse.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const hydrated = useHydrated()

  const isDark = hydrated && resolvedTheme === 'dark'

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="border-border bg-muted focus-visible:ring-ring/50 relative h-7 w-13 shrink-0 cursor-pointer rounded-full border outline-none focus-visible:ring-3"
    >
      <span
        className={cn(
          'bg-primary absolute top-0.5 left-0.5 flex size-5 items-center justify-center rounded-full text-white shadow-sm transition-transform duration-300',
          isDark ? 'translate-x-6' : 'translate-x-0',
        )}
        aria-hidden
      >
        {isDark ? <MoonIcon className="size-3" /> : <SunIcon className="size-3" />}
      </span>
    </button>
  )
}
