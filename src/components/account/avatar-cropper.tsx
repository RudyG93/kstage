'use client'

import { useCallback, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { downscaleToObjectURL, getCroppedBlob } from '@/lib/profiles/crop-image'

export function AvatarCropper({
  onCropped,
  children,
  triggerClassName,
}: {
  onCropped: (blob: Blob) => void
  // Déclencheur personnalisé (ex. PP cliquable du profil) ; défaut = bouton.
  children?: ReactNode
  triggerClassName?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const onCropComplete = useCallback((_area: Area, areaPx: Area) => setAreaPixels(areaPx), [])

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    // downscale d'abord → drag/zoom fluides même sur une grosse photo
    setSrc(await downscaleToObjectURL(file))
  }

  function close() {
    if (src) URL.revokeObjectURL(src)
    setSrc(null)
    setAreaPixels(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function apply() {
    if (!src || !areaPixels) return
    setProcessing(true)
    try {
      const blob = await getCroppedBlob(src, areaPixels)
      onCropped(blob) // l'upload + l'aperçu sont gérés par le parent (optimiste)
      close()
    } catch {
      setError('Something went wrong while processing the image.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      {children !== undefined ? (
        <button type="button" onClick={() => fileRef.current?.click()} className={triggerClassName}>
          {children}
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          Change avatar
        </Button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Upload avatar"
        className="hidden"
        onChange={(e) => void pickFile(e)}
      />

      <Dialog
        open={src !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DialogContent>
          <DialogTitle>Crop your avatar</DialogTitle>
          <div className="bg-muted relative mt-4 h-64 w-full overflow-hidden rounded-xl">
            {src && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-muted-foreground text-xs">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
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
            <Button type="button" variant="ghost" onClick={close} disabled={processing}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void apply()} disabled={processing || !areaPixels}>
              {processing ? 'Processing…' : 'Apply'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
