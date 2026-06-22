import { useState, useEffect, useCallback, useMemo } from "react"

const SCREENSHOT_FILES = import.meta.glob(
  "/public/screenshots/*.{png,jpg,jpeg,webp,avif}",
  { eager: true, query: "?url", import: "default" },
)

const IMAGES = Object.values(SCREENSHOT_FILES) as string[]

const TRANSITION_DURATION = 2000
const DISPLAY_DURATION = 10000

export function BackgroundSlideshow() {
  const initial = useMemo(() => Math.floor(Math.random() * IMAGES.length), [])
  const [currentIndex, setCurrentIndex] = useState(initial)
  const [nextIndex, setNextIndex] = useState((initial + 1) % IMAGES.length)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const blur = isMobile ? "blur(2px)" : "blur(6px)"

  useEffect(() => {
    for (const src of IMAGES) {
      const img = new Image()
      img.src = src
    }
  }, [])

  const goToNext = useCallback(() => {
    setIsTransitioning(true)
    setNextIndex((prev) => (prev + 1) % IMAGES.length)

    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % IMAGES.length)
      setIsTransitioning(false)
    }, TRANSITION_DURATION)
  }, [])

  useEffect(() => {
    const interval = setInterval(goToNext, DISPLAY_DURATION)
    return () => clearInterval(interval)
  }, [goToNext])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-2000"
        style={{
          backgroundImage: `url(${IMAGES[currentIndex]})`,
          filter: `${blur} brightness(0.6) saturate(1.05)`,
          transform: "scale(1.1)",
          opacity: isTransitioning ? 0 : 1,
          transitionDuration: `${TRANSITION_DURATION}ms`,
        }}
      />
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-2000"
        style={{
          backgroundImage: `url(${IMAGES[nextIndex]})`,
          filter: `${blur} brightness(0.6) saturate(1.05)`,
          transform: "scale(1.1)",
          opacity: isTransitioning ? 1 : 0,
          transitionDuration: `${TRANSITION_DURATION}ms`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
    </div>
  )
}
