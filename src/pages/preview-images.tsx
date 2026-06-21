import { useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

const IMAGES = [
  { src: "/screenshots/ancient_city_blue_lenterns.png", name: "Ancient City" },
  { src: "/screenshots/crazy_looking_cave_blueish.png", name: "Cave" },
  { src: "/screenshots/bone_structure_dark_cave.png", name: "Bone Cave" },
  { src: "/screenshots/blue_ice_biiiiiggg_spike_forest.png", name: "Ice Spikes" },
  { src: "/screenshots/fog_cave_dripstone.png", name: "Dripstone Cave" },
  { src: "/screenshots/deep_dark_portal.png", name: "Deep Dark" },
  { src: "/screenshots/hell_WTF.png", name: "Nether" },
  { src: "/screenshots/lush_cave_x_custom_moshrooms.png", name: "Lush Cave" },
  { src: "/screenshots/weed_dark_oak_white_fog.png", name: "Dark Oak Forest" },
  { src: "/screenshots/spikes_both_dir_kinda_cave_questionmark.png", name: "Crystal Cave" },
  { src: "/screenshots/redish_cave.png", name: "Red Cave" },
]

const TRANSITION_DURATION = 500
const AUTO_PLAY_INTERVAL = 5000

export function PreviewImagesPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const navigate = useNavigate()

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning || index === currentIndex) return
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentIndex(index)
        setIsTransitioning(false)
      }, TRANSITION_DURATION)
    },
    [isTransitioning, currentIndex]
  )

  const goNext = useCallback(() => {
    goTo((currentIndex + 1) % IMAGES.length)
  }, [currentIndex, goTo])

  const goPrev = useCallback(() => {
    goTo((currentIndex - 1 + IMAGES.length) % IMAGES.length)
  }, [currentIndex, goTo])

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

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Main image */}
      <div className="relative flex-1 overflow-hidden">
        {IMAGES.map((img, i) => (
          <img
            key={img.src}
            src={img.src}
            alt={img.name}
            className="absolute inset-0 h-full w-full object-contain transition-opacity duration-500"
            style={{ opacity: i === currentIndex && !isTransitioning ? 1 : 0 }}
          />
        ))}

        {/* Nav arrows */}
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

        {/* Back button */}
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

      {/* Thumbnail strip */}
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
              goTo(i)
            }}
            className={`shrink-0 overflow-hidden rounded-md border-2 transition-all duration-200 ${
              i === currentIndex
                ? "border-white/80 opacity-100"
                : "border-transparent opacity-40 hover:opacity-70"
            }`}
          >
            <img src={img.src} alt={img.name} className="h-14 w-20 object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
