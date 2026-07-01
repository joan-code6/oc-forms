import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

const SCREENSHOT_FILES = import.meta.glob(
  "/public/screenshots/*.{png,jpg,jpeg,webp,avif}",
  { eager: true, query: "?url", import: "default" },
)

const IMAGES = Object.entries(SCREENSHOT_FILES).map(([path, src]) => {
  const filename = path.split("/").pop() ?? path
  const basename = filename.replace(/\.\w+$/, "")
  const name = basename
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return { src: src as string, name }
})

const AUTO_PLAY_INTERVAL = 5000
const PRELOAD_AHEAD = 3

export function PreviewImagesPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const navigate = useNavigate()

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % IMAGES.length)
  }, [])

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + IMAGES.length) % IMAGES.length)
  }, [])

  useEffect(() => {
    if (!isAutoPlaying) return
    const interval = setInterval(goNext, AUTO_PLAY_INTERVAL)
    return () => clearInterval(interval)
  }, [isAutoPlaying, goNext])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext()
      if (e.key === "ArrowLeft") goPrev()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [goNext, goPrev])

  useEffect(() => {
    for (let offset = 1; offset <= PRELOAD_AHEAD; offset++) {
      const idx = (currentIndex + offset) % IMAGES.length
      const img = new Image()
      img.src = IMAGES[idx].src
      const prevIdx = (currentIndex - offset + IMAGES.length) % IMAGES.length
      const prevImg = new Image()
      prevImg.src = IMAGES[prevIdx].src
    }
  }, [currentIndex])

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <img
          key={currentIndex}
          src={IMAGES[currentIndex].src}
          alt={IMAGES[currentIndex].name}
          className="animate-in absolute inset-0 h-full w-full object-contain"
        />

        <Button
          variant="ghost"
          size="icon"
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="absolute left-4 top-4 bg-black/40 hover:bg-black/60 text-white"
        >
          Back to form
        </Button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/40">
          {currentIndex + 1} / {IMAGES.length}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-t border-white/10 bg-black/80 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="shrink-0 text-xs text-white/60 hover:text-white"
        >
          {isAutoPlaying ? "Pause" : "Play"}
        </Button>
        {IMAGES.map((img, i) => (
          <button
            key={img.src}
            onClick={() => {
              setIsAutoPlaying(false)
              setCurrentIndex(i)
            }}
            className={`shrink-0 overflow-hidden rounded-md border-2 transition-all duration-200 ${
              i === currentIndex
                ? "border-white/80 opacity-100"
                : "border-transparent opacity-40 hover:opacity-70"
            }`}
          >
            <img
              src={img.src}
              alt={img.name}
              className="h-14 w-20 object-cover"
              loading={Math.abs(i - currentIndex) <= 2 ? "eager" : "lazy"}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
