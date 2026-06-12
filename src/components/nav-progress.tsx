'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function NavProgress() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setLoading(false)
    setProgress(100)
    const t = setTimeout(() => setProgress(0), 300)
    return () => clearTimeout(t)
  }, [pathname])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href === pathname) return
      setLoading(true)
      setProgress(30)
      const t1 = setTimeout(() => setProgress(60), 200)
      const t2 = setTimeout(() => setProgress(80), 600)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [pathname])

  if (!loading && progress === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5">
      <div
        className="h-full bg-red-500 transition-all duration-300 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  )
}
