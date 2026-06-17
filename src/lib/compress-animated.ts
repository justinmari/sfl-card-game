import { convertToAnimatedWebp } from '@/app/image-actions'

// Client helper: send a GIF/WebP to the server, where sharp converts it to an
// animated WebP under ~200KB, then return it as a Blob ready to upload.
export async function compressAnimatedToWebp(file: File): Promise<Blob> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await convertToAnimatedWebp(fd)
  if ('error' in res) throw new Error(res.error)

  const bin = atob(res.dataBase64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: 'image/webp' })
}
