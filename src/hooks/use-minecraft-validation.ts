import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

export interface MinecraftValidationResult {
  success: boolean
  username?: string
  uuid?: string
  skinUrl?: string | null
  error?: string
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export function useMinecraftValidation(username: string) {
  const cleanUsername = username.trim()
  const debouncedUsername = useDebounce(cleanUsername, 500)

  const enabled =
    debouncedUsername.length >= 3 &&
    debouncedUsername.length <= 16 &&
    /^[a-zA-Z0-9_]+$/.test(debouncedUsername)

  return useQuery({
    queryKey: ["minecraft-validate", debouncedUsername.toLowerCase()],
    queryFn: async (): Promise<MinecraftValidationResult> => {
      const res = await fetch(
        `https://playerdb.co/api/player/minecraft/${encodeURIComponent(debouncedUsername)}`,
        {
          headers: { Accept: "application/json" },
        }
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.success === false || !data.data?.player) {
        return { success: false, error: "Minecraft account not found." }
      }

      const player = data.data.player

      return {
        success: true,
        username: player.username,
        uuid: player.id,
        skinUrl: player.avatar || player.thumbnail_url || null,
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
