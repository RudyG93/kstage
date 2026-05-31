'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const OPTIONS = [
  { value: 'az', label: 'A–Z' },
  { value: 'za', label: 'Z–A' },
  { value: 'pop_desc', label: 'Most followed' },
  { value: 'pop_asc', label: 'Least followed' },
] as const

export function GroupSort({ value }: { value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    const v = e.target.value
    if (v && v !== 'az') params.set('sort', v)
    else params.delete('sort')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
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
