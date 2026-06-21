import { useState, useEffect, useCallback } from "react"

const IMAGES = [
  "/screenshots/ancient_city_blue_lenterns.png",
  "/screenshots/crazy_looking_cave_blueish.png",
  "/screenshots/bone_structure_dark_cave.png",
  "/screenshots/blue_ice_biiiiiggg_spike_forest.png",
  "/screenshots/fog_cave_dripstone.png",
  "/screenshots/deep_dark_portal.png",
  "/screenshots/hell_WTF.png",
  "/screenshots/lush_cave_x_custom_moshrooms.png",
  "/screenshots/weed_dark_oak_white_fog.png",
  "/screenshots/spikes_both_dir_kinda_cave_questionmark.png",
  "/screenshots/redish_cave.png",
]

const TRANSITION_DURATION = 2000
const DISPLAY_DURATION = 6000

export function BackgroundSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextIndex, setNextIndex] = useState(1)
  const [isTransitioning, setIsTransitioning] = useState(false)

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
          filter: "blur(6px) brightness(0.6) saturate(1.05)",
          transform: "scale(1.1)",
          opacity: isTransitioning ? 0 : 1,
          transitionDuration: `${TRANSITION_DURATION}ms`,
        }}
      />
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-2000"
        style={{
          backgroundImage: `url(${IMAGES[nextIndex]})`,
          filter: "blur(6px) brightness(0.6) saturate(1.05)",
          transform: "scale(1.1)",
          opacity: isTransitioning ? 1 : 0,
          transitionDuration: `${TRANSITION_DURATION}ms`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
    </div>
  )
}
