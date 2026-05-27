export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

const OUTPUT_SIZE = 512

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', () => reject(new Error('Could not load image')))
    img.src = src
  })
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
