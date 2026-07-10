'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchIcon, XIcon } from 'lucide-react'

// Champ de recherche (§7.3.1) : 40px, focus ring primary, debounce 300ms →
// router.replace (?q=), autofocus, bouton clear.
export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.trim()) params.set('q', next.trim())
    else params.delete('q')
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
    })
  }

  function onChange(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(next), 300)
  }

  return (
    // Ring porté par focus-within (comme header-search), pas statique : un
    // ring permanent rend le focus clavier invisible (WCAG 2.4.7).
    <div className="focus-within:border-primary/50 focus-within:ring-primary/15 bg-secondary flex h-10 items-center gap-2 rounded-[10px] border px-3 transition-shadow focus-within:ring-2">
      <SearchIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Groups, MVs, events…"
        aria-label="Search"
        className="placeholder:text-faint w-full bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue('')
            commit('')
            inputRef.current?.focus()
          }}
          className="text-muted-foreground hover:text-foreground shrink-0 p-1"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}
