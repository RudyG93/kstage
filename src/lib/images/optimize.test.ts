import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { MAX_SOURCE_BYTES, optimizeImageBuffer } from './optimize'

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 90 } },
  })
    .png()
    .toBuffer()
}

describe('optimizeImageBuffer', () => {
  it('réduit le côté long à 800 px max et sort du webp', async () => {
    const src = await makePng(2400, 1200)
    const out = await optimizeImageBuffer(src)
    const meta = await sharp(out).metadata()
    expect(meta.format).toBe('webp')
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(800)
    // Le ratio est conservé (2:1).
    expect((meta.width ?? 0) / (meta.height ?? 1)).toBeCloseTo(2, 1)
  })

  it("n'agrandit jamais une petite image", async () => {
    const src = await makePng(300, 200)
    const out = await optimizeImageBuffer(src)
    const meta = await sharp(out).metadata()
    expect(meta.width).toBe(300)
    expect(meta.height).toBe(200)
  })

  it('respecte un maxSide custom (bannières)', async () => {
    const src = await makePng(3000, 1000)
    const out = await optimizeImageBuffer(src, { maxSide: 1600 })
    const meta = await sharp(out).metadata()
    expect(meta.width).toBe(1600)
  })

  it('rejette une source au-dessus du cap 10 Mo AVANT décodage', async () => {
    const huge = Buffer.alloc(MAX_SOURCE_BYTES + 1)
    await expect(optimizeImageBuffer(huge)).rejects.toThrow(/cap 10 MB/)
  })

  it('rejette un buffer non-image', async () => {
    await expect(optimizeImageBuffer(Buffer.from('not an image'))).rejects.toThrow()
  })
})
