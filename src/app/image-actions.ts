'use server'

import sharp from 'sharp'

const TARGET_BYTES = 200 * 1024

// Convert an uploaded animated source (GIF or WebP) to an animated WebP under
// ~200KB, preserving animation. Steps WebP quality down, then resolution, until
// under target (best-effort). Returns the WebP bytes as base64 (the client
// decodes and uploads it). Runs only at upload time.
export async function convertToAnimatedWebp(
  formData: FormData,
): Promise<{ dataBase64: string } | { error: string }> {
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'No file provided' }

  try {
    const input = Buffer.from(await file.arrayBuffer())
    const encode = (quality: number, width?: number) => {
      let pipe = sharp(input, { animated: true })
      if (width) pipe = pipe.resize({ width })
      return pipe.webp({ quality, effort: 4 }).toBuffer()
    }

    // 1) Drop quality first (keeps full resolution — best perceived quality).
    let buf = await encode(80)
    for (const q of [65, 50, 40, 30]) {
      if (buf.length <= TARGET_BYTES) break
      buf = await encode(q)
    }

    // 2) Only if still over, scale resolution down (last resort).
    if (buf.length > TARGET_BYTES) {
      const width = (await sharp(input, { animated: true }).metadata()).width ?? 0
      for (const scale of [0.75, 0.6, 0.45, 0.35]) {
        if (buf.length <= TARGET_BYTES || !width) break
        buf = await encode(45, Math.max(120, Math.round(width * scale)))
      }
    }

    return { dataBase64: buf.toString('base64') }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Conversion failed' }
  }
}
