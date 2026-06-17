import { MAX_UPLOAD_BYTES } from './compress-image'

// Escalating gifsicle passes — each more aggressive than the last (higher lossy,
// fewer colors, smaller scale). The first pass that lands under the target wins;
// if none do, the smallest (most aggressive) result is returned best-effort.
// `IN` is replaced with the input filename. Animation is preserved throughout.
const LADDER = [
  '-O2 --lossy=40 IN -o /out/out.gif',
  '-O2 --lossy=80 --colors 128 IN -o /out/out.gif',
  '-O2 --lossy=120 --colors 64 --scale 0.85 IN -o /out/out.gif',
  '-O3 --lossy=160 --colors 48 --scale 0.7 IN -o /out/out.gif',
  '-O3 --lossy=200 --colors 32 --scale 0.55 IN -o /out/out.gif',
  '-O3 --lossy=200 --colors 24 --scale 0.45 IN -o /out/out.gif',
  '-O3 --lossy=200 --colors 16 --scale 0.35 IN -o /out/out.gif',
]

// Shrink an animated GIF toward `targetBytes` (default 100KB) while keeping it a
// GIF (and animated). Runs gifsicle in-browser; the module is loaded lazily so
// its ~150KB (gzip) WASM only ships when someone actually uploads a GIF.
export async function compressGif(file: File, targetBytes = MAX_UPLOAD_BYTES): Promise<Blob> {
  if (file.size <= targetBytes) return file

  const { default: gifsicle } = await import('gifsicle-wasm-browser')
  const name = 'in.gif'
  let best: File | null = null

  for (const step of LADDER) {
    const out: File[] = await gifsicle.run({
      input: [{ file, name }],
      command: [step.replace('IN', name)],
    })
    const result = out?.[0]
    if (!result) continue
    if (!best || result.size < best.size) best = result
    if (result.size <= targetBytes) return result
  }

  return best ?? file
}
