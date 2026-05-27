export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

const OUTPUT_SIZE = 512
const MAX_SOURCE_DIM = 1024

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', () => reject(new Error('Could not load image')))
    img.src = src
  })
}

// Réduit une image source haute résolution à `maxDim` px max et renvoie un
// object URL. Le cropper manipule ainsi une petite image → drag/zoom fluides.
// L'appelant est responsable du `URL.revokeObjectURL` sur la valeur retournée.
export async function downscaleToObjectURL(file: File, maxDim = MAX_SOURCE_DIM): Promise<string> {
  const srcUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(srcUrl)
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale === 1) return srcUrl // déjà assez petite

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return srcUrl

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
    if (!blob) return srcUrl

    URL.revokeObjectURL(srcUrl)
    return URL.createObjectURL(blob)
  } catch {
    return srcUrl
  }
}

// Recadre `src` selon la zone (en pixels source) renvoyée par react-easy-crop
// et produit un JPEG carré 512×512 (l'affichage rond se fait en CSS).
export async function getCroppedBlob(src: string, crop: PixelCrop): Promise<Blob> {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported')

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export image'))),
      'image/jpeg',
      0.9,
    )
  })
}
