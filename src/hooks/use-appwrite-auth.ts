import { useState, useEffect, useCallback } from "react"
import { getCurrentUser, discordLogin, logout, getSession } from "@/lib/appwrite"
import type { Models } from "appwrite"

export interface DiscordUser {
  id: string
  name: string
  email: string
  avatar?: string
  raw: Models.User<Models.Preferences>
}

export function useAppwriteAuth() {
  const [user, setUser] = useState<DiscordUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkSession = useCallback(async () => {
    try {
      const session = await getSession()
      if (!session) {
        setUser(null)
        setLoading(false)
        return
      }
      const currentUser = await getCurrentUser()
      if (currentUser) {
        setUser({
          id: currentUser.$id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.prefs?.avatar ?? undefined,
          raw: currentUser,
        })
      } else {
        setUser(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify session")
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const session = await getSession()
        if (cancelled) return
        if (!session) {
          setUser(null)
          setLoading(false)
          return
        }
        const currentUser = await getCurrentUser()
        if (cancelled) return
        if (currentUser) {
          setUser({
            id: currentUser.$id,
            name: currentUser.name,
            email: currentUser.email,
            avatar: currentUser.prefs?.avatar ?? undefined,
            raw: currentUser,
          })
        } else {
          setUser(null)
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to verify session")
        setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const loginWithDiscord = useCallback(() => {
    discordLogin()
  }, [])

  const logoutUser = useCallback(async () => {
    try {
      await logout()
      setUser(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to logout")
    }
  }, [])

  return {
    user,
    loading,
    error,
    loginWithDiscord,
    logoutUser,
    refetch: checkSession,
  }
}
