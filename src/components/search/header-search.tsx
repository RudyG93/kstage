'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { SearchIcon } from 'lucide-react'
import { faceCrop } from '@/lib/images/cloudinary'
import { displaySongTitle } from '@/lib/events/title'

interface QuickResults {
  groups: { slug: string; name: string; image: string | null; isSolo: boolean }[]
  mvs: { slug: string | null; title: string; group: string | null; videoId: string | null }[]
}

/**
 * Recherche live du header (desktop) : dropdown de résultats instantanés
 * (debounce 250 ms → /api/search/quick), clic = navigation directe,
 * Enter = page /search?q=. Sur mobile le header garde un simple lien /search
 * (géré par le parent).
 */
export function HeaderSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<QuickResults | null>(null)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Fermeture : au clic sur un résultat (onClick des liens), à Escape, au clic
  // extérieur — pas d'effet sur pathname (lint set-state-in-effect).
  function closeAndReset() {
    setOpen(false)
    setQ('')
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function onChange(next: string) {
    setQ(next)
    if (timer.current) clearTimeout(timer.current)
    if (next.trim().length < 2) {
      setResults(null)
      setOpen(false)
      return
    }
    timer.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await fetch(`/api/search/quick?q=${encodeURIComponent(next.trim())}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = (await res.json()) as QuickResults
        setResults(data)
        setOpen(true)
      } catch {
        // requête annulée/réseau — silencieux
      }
    }, 250)
  }

  function submit() {
    if (!q.trim()) return
    setOpen(false)
    router.push(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  const hasResults = results && (results.groups.length > 0 || results.mvs.length > 0)

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="bg-secondary focus-within:border-primary/50 focus-within:ring-primary/15 flex h-[33px] items-center gap-2 rounded-[8px] border px-3 transition-shadow focus-within:ring-2">
        <SearchIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setOpen(false)
            // ↓ entre dans les résultats (navigation clavier, audit UX 2026-07-04).
            if (e.key === 'ArrowDown' && open) {
              e.preventDefault()
              rootRef.current?.querySelector<HTMLElement>('[data-search-result]')?.focus()
            }
          }}
          onFocus={() => {
            if (hasResults) setOpen(true)
          }}
          placeholder="Groups, MVs, events…"
          aria-label="Search"
          className="placeholder:text-faint w-full bg-transparent text-xs outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      {open && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- délégation clavier ; les cibles focusables sont les liens enfants
        <div
          className="bg-card absolute top-full left-0 z-50 mt-1.5 w-full overflow-hidden rounded-[10px] border shadow-lg"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Escape') return
            e.preventDefault()
            if (e.key === 'Escape') {
              setOpen(false)
              rootRef.current?.querySelector('input')?.focus()
              return
            }
            const items = [
              ...(rootRef.current?.querySelectorAll<HTMLElement>('[data-search-result]') ?? []),
            ]
            const idx = items.indexOf(document.activeElement as HTMLElement)
            const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
            if (next < 0) rootRef.current?.querySelector('input')?.focus()
            else items[Math.min(next, items.length - 1)]?.focus()
          }}
        >
          {!hasResults ? (
            <p className="text-muted-foreground px-3 py-3 text-xs">No results for “{q.trim()}”.</p>
          ) : (
            <>
              {results.groups.map((g) => (
                <Link
                  key={g.slug}
                  href={`/groups/${g.slug}`}
                  data-search-result
                  onClick={closeAndReset}
                  className="hover:bg-secondary/60 flex items-center gap-2.5 px-3 py-2 transition-colors"
                >
                  {g.image ? (
                    <Image
                      src={faceCrop(g.image, 48, 48)}
                      alt=""
                      width={24}
                      height={24}
                      unoptimized
                      className="size-6 shrink-0 rounded-[6px] object-cover"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="gradient-signature flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[10px] font-bold text-white"
                      aria-hidden
                    >
                      {g.name[0]}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{g.name}</span>
                  <span className="label-data-inline text-faint text-[8px]">
                    {g.isSolo ? 'Solo' : 'Group'}
                  </span>
                </Link>
              ))}
              {results.mvs.map((m, i) => (
                <Link
                  key={m.slug ?? i}
                  href={m.slug ? `/mv/${m.slug}` : '/mvs'}
                  data-search-result
                  onClick={closeAndReset}
                  className="hover:bg-secondary/60 flex items-center gap-2.5 border-t px-3 py-2 transition-colors"
                >
                  {m.videoId ? (
                    <Image
                      src={`https://i.ytimg.com/vi/${m.videoId}/default.jpg`}
                      alt=""
                      width={36}
                      height={20}
                      unoptimized
                      className="h-5 w-9 shrink-0 rounded-[4px] object-cover"
                      aria-hidden
                    />
                  ) : (
                    <span className="bg-muted h-5 w-9 shrink-0 rounded-[4px]" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {displaySongTitle(m.title, m.group ?? undefined)}
                  </span>
                  <span className="label-data-inline text-faint text-[8px]">MV</span>
                </Link>
              ))}
              <button
                type="button"
                data-search-result
                onClick={submit}
                className="label-data-inline text-primary hover:bg-secondary/60 w-full border-t px-3 py-2 text-left text-[9px] transition-colors"
              >
                All results for “{q.trim()}” →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
