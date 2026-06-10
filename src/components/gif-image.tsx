'use client'

import { useRef, useEffect, useState } from 'react'

export default function GifImage({
  src,
  alt,
  className,
  animate,
}: {
  src: string
  alt: string
  className?: string
  animate: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [staticFrame, setStaticFrame] = useState<string | null>(null)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      setStaticFrame(canvas.toDataURL('image/png'))
    }
    img.src = src
  }, [src])

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <img
        src={animate ? src : (staticFrame || src)}
        alt={alt}
        className={className}
      />
    </>
  )
}
