import { useEffect, useRef } from 'react'

export default function ScrollIcon() {
  const iconRef = useRef<HTMLDivElement>(null)
  const lastY = useRef(0)
  const tiltRef = useRef(0)

  useEffect(() => {
    const el = iconRef.current
    if (!el) return

    const onScroll = () => {
      const scrollY = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const pct = maxScroll > 0 ? scrollY / maxScroll : 0
      const speed = scrollY - lastY.current
      lastY.current = scrollY

      tiltRef.current = Math.max(-25, Math.min(25, speed * 2))
      el.style.top = `${8 + pct * (window.innerHeight - 34)}px`
      el.style.transform = `translateY(-50%) rotate(${tiltRef.current}deg)`
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div id="scroll-icon" ref={iconRef} style={{ top: '8px' }}>
      ⚽
    </div>
  )
}
