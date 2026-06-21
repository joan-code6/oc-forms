import { useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAppwriteAuth } from "@/hooks/use-appwrite-auth"

function getReturnPath(searchParams: URLSearchParams): string {
  const urlReturnTo = searchParams.get("returnTo")
  if (urlReturnTo) return urlReturnTo
  try {
    const stored = sessionStorage.getItem("auth_return_to") || localStorage.getItem("auth_return_to")
    if (stored) {
      sessionStorage.removeItem("auth_return_to")
      localStorage.removeItem("auth_return_to")
      return stored
    }
  } catch { /* ignore */ }
  return "/"
}

export function AuthCallback() {
  const { user, loading, error, refetch } = useAppwriteAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirected = useRef(false)
  const returnPath = useRef(getReturnPath(searchParams))

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    if (loading) return
    if (redirected.current) return

    redirected.current = true
    if (user) {
      navigate(returnPath.current, { replace: true })
    } else {
      navigate(returnPath.current, { replace: true })
    }
  }, [loading, user, navigate])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading && !redirected.current) {
        redirected.current = true
        navigate(returnPath.current, { replace: true })
      }
    }, 8000)
    return () => clearTimeout(timer)
  }, [loading, navigate])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-white/50">Verifying your Discord account...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-red-400">Authentication failed: {error}</p>
        <button
          onClick={() => navigate(returnPath.current, { replace: true })}
          className="mt-2 rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Go back
        </button>
      </div>
    )
  }

  return null
}
