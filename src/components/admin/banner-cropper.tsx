'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Cropper, { type Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { setGroupBanner } from '@/lib/groups/banner-actions'
import { getCroppedBlob } from '@/lib/profiles/crop-image'
import { cloudinaryProxy } from '@/lib/images/cloudinary'

// Format 8:1 — rapprochement raisonnable du ratio rendu desktop (~12.5:1) sans
// rendre le cropper inutilisable sur mobile (~4:1). Sortie 1600×200.
const ASPECT = 8
const OUT_W = 1600
const OUT_H = 200

export function BannerCropper({
  groupId,
  name,
  sourceUrl,
  onDone,
}: {
  groupId: string
  name: string
  sourceUrl: string
  onDone: (url: string) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // chargé via Cloudinary → CORS activé pour l'export canvas
  // source ≥ sortie cible (OUT_W=1600) → pas d'upscaling au canvas, image nette.
  const src = cloudinaryProxy(sourceUrl, 1600)
  const onCropComplete = useCallback((_a: Area, px: Area) => setAreaPixels(px), [])

  function apply() {
    if (!areaPixels) return
    start(async () => {
      try {
        const blob = await getCroppedBlob(src, areaPixels, OUT_W, OUT_H)
        const fd = new FormData()
        fd.append('banner', new File([blob], 'banner.jpg', { type: 'image/jpeg' }))
        const res = await setGroupBanner(groupId, fd)
        if ('error' in res) {
          setError(res.error)
          return
        }
        onDone(res.bannerUrl)
        setOpen(false)
        router.refresh()
      } catch {
        setError('Something went wrong while processing the image.')
      }
    })
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Adjust banner
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(95vw,1400px)]">
          <DialogTitle>Adjust banner — {name}</DialogTitle>
          <div
            className="bg-muted relative mt-4 w-full overflow-hidden rounded-xl"
            style={{ aspectRatio: '8 / 1' }}
          >
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={ASPECT}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-muted-foreground text-xs">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="flex-1 accent-[#5b5bf0]"
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={apply} disabled={pending || !areaPixels}>
              {pending ? 'Saving…' : 'Save banner'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
