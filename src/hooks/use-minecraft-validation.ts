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
      const encodedName = encodeURIComponent(debouncedUsername)

      try {
        const res = await fetch(
          `https://playerdb.co/api/player/minecraft/${encodedName}`,
          { headers: { Accept: "application/json" } }
        )

        const data = await res.json().catch(() => ({}))
 
        if (res.ok && data.success !== false && data.data?.player) {
          const player = data.data.player
          return {
            success: true,
            username: player.username,
            uuid: player.id,
            skinUrl: player.avatar || player.thumbnail_url || null,
          }
        }
      } catch {
        // PlayerDB unreachable - try Mojang fallback
      }

      try {
        const mojangRes = await fetch(
          `https://api.mojang.com/users/profiles/minecraft/${encodedName}`
        )

        if (mojangRes.ok) {
          const profile = await mojangRes.json().catch(() => null)
          if (profile?.id) {
            return {
              success: true,
              username: profile.name,
              uuid: profile.id,
              skinUrl: null,
            }
          }
        }
      } catch {
        // Mojang also unreachable
      }

      return { success: false, error: "Minecraft account not found." }
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
