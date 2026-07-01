import { useState, useEffect, useCallback, useMemo, useRef } from "react"

const SCREENSHOT_FILES = import.meta.glob(
  "/public/screenshots/*.{png,jpg,jpeg,webp,avif}",
  { eager: true, query: "?url", import: "default" },
)

const IMAGES = Object.values(SCREENSHOT_FILES) as string[]

const TRANSITION_DURATION = 2000
const DISPLAY_DURATION = 10000
const PRELOAD_CONCURRENCY = 3

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
  })
}

export function BackgroundSlideshow() {
  const initial = useMemo(() => Math.floor(Math.random() * IMAGES.length), [])
  const [currentIndex, setCurrentIndex] = useState(initial)
  const [nextIndex, setNextIndex] = useState((initial + 1) % IMAGES.length)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const loadedRef = useRef(new Set<string>())

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    let cancelled = false

    const displayOrder = IMAGES.map((_, i) => (initial + i) % IMAGES.length)

    const preloadAll = async () => {
      for (let i = 0; i < displayOrder.length; i += PRELOAD_CONCURRENCY) {
        const batch = displayOrder.slice(i, i + PRELOAD_CONCURRENCY)
        await Promise.all(batch.map((idx) => preloadImage(IMAGES[idx])))
        if (cancelled) return
        batch.forEach((idx) => loadedRef.current.add(IMAGES[idx]))
        if (i === 0) setInitialLoaded(true)
      }
    }

    preloadAll()
    return () => {
      cancelled = true
    }
  }, [initial])

  const goToNext = useCallback(() => {
    setIsTransitioning(true)
    setNextIndex((prev) => (prev + 1) % IMAGES.length)

    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % IMAGES.length)
      setIsTransitioning(false)
    }, TRANSITION_DURATION)
  }, [])

  useEffect(() => {
    if (!initialLoaded) return
    const interval = setInterval(goToNext, DISPLAY_DURATION)
    return () => clearInterval(interval)
  }, [goToNext, initialLoaded])

  const blur = isMobile ? "blur(2px)" : "blur(6px)"

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 100%)",
          opacity: initialLoaded ? 0 : 1,
        }}
      />
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-2000"
        style={{
          backgroundImage: `url(${IMAGES[currentIndex]})`,
          filter: `${blur} brightness(0.6) saturate(1.05)`,
          transform: "scale(1.1)",
          opacity: initialLoaded && !isTransitioning ? 1 : 0,
          transitionDuration: `${TRANSITION_DURATION}ms`,
        }}
      />
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-2000"
        style={{
          backgroundImage: `url(${IMAGES[nextIndex]})`,
          filter: `${blur} brightness(0.6) saturate(1.05)`,
          transform: "scale(1.1)",
          opacity: initialLoaded && isTransitioning ? 1 : 0,
          transitionDuration: `${TRANSITION_DURATION}ms`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
    </div>
  )
}
