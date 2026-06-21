import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { getAccount } from "@/lib/appwrite"

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
      getAccount()
        .createSession({ userId, secret })
        .then(() => {
          navigate(returnPath.current, { replace: true })
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-red-400">Authentication failed. Please try again.</p>
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
