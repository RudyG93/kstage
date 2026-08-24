'use client'

import type { Route } from 'next'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const OPTIONS = [
  // Défaut : met en avant les artistes qui sortent quelque chose (2026-08-21).
  { value: 'activity', label: 'Activity' },
  { value: 'az', label: 'A–Z' },
  { value: 'za', label: 'Z–A' },
  // « Most followed » retiré (2026-08-24) : 79 follows posés par 3 comptes sur
  // 267 groupes, dont 195 à zéro — les trois quarts de la page étaient un A–Z
  // déguisé en classement de popularité. Le tri reviendra quand le signal
  // existera. `?sort=pop_desc` retombe sur `activity` (garde de la page).
] as const

export function GroupSort({ value }: { value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    const v = e.target.value
    if (v && v !== 'activity') params.set('sort', v)
    else params.delete('sort')
    const qs = params.toString()
    router.push((qs ? `${pathname}?${qs}` : pathname) as Route)
  }

  return (
    <select
      aria-label="Sort"
      value={value}
      onChange={onChange}
      className="border-input bg-background focus-visible:ring-ring/50 h-9 cursor-pointer rounded-md border px-2.5 text-sm outline-none focus-visible:ring-2"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
