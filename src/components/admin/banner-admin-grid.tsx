'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { faceCrop } from '@/lib/images/cloudinary'
import { resetGroupBanner } from '@/lib/groups/banner-actions'
import { BannerCropper } from './banner-cropper'

export interface BannerGroup {
  id: string
  name: string
  image_url: string | null
  image_landscape: string | null
  banner_url: string | null
}

function GroupItem({ g }: { g: BannerGroup }) {
  const [banner, setBanner] = useState<string | null>(g.banner_url)
  const [resetPending, startReset] = useTransition()
  const router = useRouter()
  // source = Deezer (image_url, plus récente que la fanart TheAudioDB)
  const source = g.image_url
  const preview = banner ?? (source ? faceCrop(source, 600, 200) : null)

  function reset() {
    startReset(async () => {
      const res = await resetGroupBanner(g.id)
      if ('error' in res) return
      setBanner(null)
      router.refresh()
    })
  }

  return (
    <div className="bg-card ring-foreground/10 space-y-2 rounded-xl p-3 ring-1">
      <div
        className="bg-muted relative w-full overflow-hidden rounded-lg"
        style={{ aspectRatio: '3 / 1' }}
      >
        {preview && <Image src={preview} alt="" fill unoptimized className="object-cover" />}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">
          {g.name}
          {banner && <span className="text-emerald-500"> ✓</span>}
        </span>
        <div className="flex shrink-0 gap-2">
          {banner && (
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={resetPending}>
              {resetPending ? '…' : 'Reset'}
            </Button>
          )}
          {source && (
            <BannerCropper groupId={g.id} name={g.name} sourceUrl={source} onDone={setBanner} />
          )}
        </div>
      </div>
    </div>
  )
}

export function BannerAdminGrid({ groups }: { groups: BannerGroup[] }) {
  const [q, setQ] = useState('')
  const filtered = q ? groups.filter((g) => g.name.toLowerCase().includes(q.toLowerCase())) : groups

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a group…"
        className="focus-visible:ring-ring/50 bg-background h-9 w-full max-w-sm rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
      />
      <p className="text-muted-foreground text-xs">
        {filtered.length} groups · ✓ = bandeau personnalisé
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((g) => (
          <GroupItem key={g.id} g={g} />
        ))}
      </div>
    </div>
  )
}
