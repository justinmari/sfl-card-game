// Upload size ceiling: aim to land every image/gif under 100KB (best effort).
export const MAX_UPLOAD_BYTES = 100 * 1024

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

function fit(width: number, height: number, maxWidth: number, maxHeight: number) {
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
  }
  return { width, height }
}

function encode(img: HTMLImageElement, width: number, height: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, width, height)
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to compress image'))), 'image/jpeg', quality)
  })
}

// Compress a still image to JPEG, scaling down to fit the bounds, then stepping
// quality (and finally dimensions) down until it lands under `targetBytes`
// (default 1MB). Returns the best effort if it can't get under the floor.
export async function compressImage(
  file: File,
  maxWidth = 800,
  maxHeight = 1100,
  quality = 0.8,
  targetBytes = MAX_UPLOAD_BYTES,
): Promise<Blob> {
  const img = await loadImage(file)
  let { width, height } = fit(img.width, img.height, maxWidth, maxHeight)

  let q = quality
  let blob = await encode(img, width, height, q)
  // Step quality down to a floor, then shrink dimensions (resetting quality a
  // little), alternating until under target or we hit the minimum size.
  while (blob.size > targetBytes) {
    if (q > 0.35) {
      q = Math.max(0.35, q - 0.15)
    } else if (width > 200 && height > 200) {
      width = Math.round(width * 0.8)
      height = Math.round(height * 0.8)
      q = Math.min(quality, 0.6) // headroom back after shrinking
    } else {
      break // hit the floor — return best effort
    }
    blob = await encode(img, width, height, q)
  }
  return blob
}
