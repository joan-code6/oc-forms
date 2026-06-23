import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { createSessionAndStore } from "@/lib/appwrite"

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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnPath = useRef(getReturnPath(searchParams))
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading")
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const userId = searchParams.get("userId")
    const secret = searchParams.get("secret")

    if (userId && secret) {
      createSessionAndStore(userId, secret)
        .then((session) => {
          if (session) {
            navigate(returnPath.current, { replace: true })
          } else {
            setStatus("error")
          }
        })
        .catch(() => {
          setStatus("error")
        })
    } else {
      navigate(returnPath.current, { replace: true })
    }
  }, [searchParams, navigate])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "loading" && !processed.current) {
        processed.current = true
        navigate(returnPath.current, { replace: true })
      }
    }, 10000)
    return () => clearTimeout(timer)
  }, [status, navigate])

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-white/50">Verifying your Discord account...</p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-red-400">Authentication failed. Please try again.</p>
        <p className="max-w-md text-sm text-white/40">
          If you're using Opera GX or Brave, the tracker/ad blocker or strict cookie settings may be preventing login.
          Try disabling the blocker for this site, allowing third-party cookies, or use Chrome / Edge / Firefox.
        </p>
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
