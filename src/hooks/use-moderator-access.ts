import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAppwriteAuth } from "@/hooks/use-appwrite-auth"
import { discordLogin } from "@/lib/appwrite"
import { callFunction } from "@/lib/functions"

const VERIFY_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_VERIFY_MOD_ID || "verify-moderator-access"

interface VerifyResult {
  allowed: boolean
  userId?: string
  discordId?: string
  discordUsername?: string
  isAdmin?: boolean
}

export interface ModeratorAccessState {
  loading: boolean
  allowed: boolean
  denied: boolean
  isAdmin: boolean
  discordUsername: string | null
}

export function useModeratorAccess(): ModeratorAccessState {
  const { user, loading: authLoading } = useAppwriteAuth()
  const [state, setState] = useState<ModeratorAccessState>({
    loading: true,
    allowed: false,
    denied: false,
    isAdmin: false,
    discordUsername: null,
  })
  const navigate = useNavigate()
  const loginAttempted = useRef(false)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      if (!loginAttempted.current) {
        loginAttempted.current = true
        discordLogin(window.location.pathname)
      }
      return
    }

    let cancelled = false
    callFunction<VerifyResult>(VERIFY_FUNCTION_ID)
      .then((result) => {
        if (cancelled) return
        setState({
          loading: false,
          allowed: result.allowed,
          denied: !result.allowed,
          isAdmin: result.isAdmin ?? false,
          discordUsername: result.discordUsername ?? null,
        })
        if (!result.allowed) {
          navigate("/no-access")
        }
      })
      .catch(() => {
        if (cancelled) return
        setState({
          loading: false,
          allowed: false,
          denied: true,
          isAdmin: false,
          discordUsername: null,
        })
        navigate("/no-access")
      })

    return () => {
      cancelled = true
    }
  }, [user, authLoading, navigate])

  return state
}
