import { useState, useEffect, useCallback, useRef } from "react"
import { getCurrentUser, discordLogin, logout, getSession, shouldShowHelpPopup } from "@/lib/appwrite"
import type { Models } from "appwrite"
import { toast } from "sonner"

export interface DiscordUser {
  id: string
  name: string
  email: string
  avatar?: string
  raw: Models.User<Models.Preferences>
}

const HELP_DISMISSED_KEY = "outcraft-help-dismissed"

export function useAppwriteAuth() {
  const [user, setUser] = useState<DiscordUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const helpShownRef = useRef(false)

  const checkHelpPopup = useCallback(() => {
    if (helpShownRef.current) return
    try {
      if (sessionStorage.getItem(HELP_DISMISSED_KEY) === "true") return
    } catch { /* ignore */ }
    if (shouldShowHelpPopup()) {
      helpShownRef.current = true
      toast("It seems like you've encountered an error...", {
        description: "If you need help, create a ticket in our Discord server: discord.gg/outcraft",
        duration: Infinity,
        dismissible: true,
        onDismiss: () => {
          try { sessionStorage.setItem(HELP_DISMISSED_KEY, "true") } catch { /* ignore */ }
        },
        action: {
          label: "Dismiss",
          onClick: () => {
            try { sessionStorage.setItem(HELP_DISMISSED_KEY, "true") } catch { /* ignore */ }
          },
        },
      })
    }
  }, [])

  const checkSession = useCallback(async () => {
    try {
      const session = await Promise.race([
        getSession(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ])
      if (!session) {
        setUser(null)
        setLoading(false)
        checkHelpPopup()
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
      const msg = e instanceof Error ? e.message : "Failed to verify session"
      setError(msg + (msg.includes("session") ? ". If you're using Opera GX or Brave, try disabling the tracker/ad blocker or use another browser." : ""))
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [checkHelpPopup])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const session = await Promise.race([
          getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ])
        if (cancelled) return
        if (!session) {
          setUser(null)
          setLoading(false)
          checkHelpPopup()
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
          checkHelpPopup()
        }
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : "Failed to verify session"
        setError(msg + (msg.toLowerCase().includes("session") ? ". If you're using Opera GX or Brave, try disabling the tracker/ad blocker or use another browser." : ""))
        setUser(null)
        checkHelpPopup()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [checkHelpPopup])

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
