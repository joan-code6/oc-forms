import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react"
import { createSessionAndStore } from "@/lib/appwrite"
import { checkStorage, isPrivacyBrowserLikely } from "@/lib/storage-check"

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
  const [storageIssue, setStorageIssue] = useState(false)
  const [oauthError, setOauthError] = useState<{ message: string; code?: string } | null>(null)
  const processed = useRef(false)
  const retryCount = useRef(0)

  const tryCreateSession = useCallback(() => {
    const userId = searchParams.get("userId")
    const secret = searchParams.get("secret")
    const type = searchParams.get("type")
    const errorMsg = searchParams.get("message")
    const errorCode = searchParams.get("code")

    console.warn("[auth-callback] params:", {
      hasUserId: !!userId,
      hasSecret: !!secret,
      type: type || "(none)",
      message: errorMsg || "(none)",
      code: errorCode || "(none)",
    })

    if (type === "failure" || errorMsg) {
      setOauthError({
        message: errorMsg || "Discord authentication was denied or failed.",
        code: errorCode || undefined,
      })
      setStatus("error")
      return
    }

    if (!userId || !secret) {
      setOauthError({
        message: "No authentication tokens received. Discord authentication may have failed or the link may be invalid.",
      })
      setStatus("error")
      return
    }

    createSessionAndStore(userId, secret)
      .then((session) => {
        if (session) {
          navigate(returnPath.current, { replace: true })
        } else {
          const storage = checkStorage()
          if (!storage.localStorage || !storage.cookies) {
            setStorageIssue(true)
          } else {
            setStorageIssue(false)
          }
          setStatus("error")
        }
      })
      .catch(() => {
        setStatus("error")
      })
  }, [searchParams, navigate])

  useEffect(() => {
    if (processed.current) return
    processed.current = true
    tryCreateSession()
  }, [tryCreateSession])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "loading" && !processed.current) {
        processed.current = true
        navigate(returnPath.current, { replace: true })
      }
    }, 10000)
    return () => clearTimeout(timer)
  }, [status, navigate])

  const handleRetry = () => {
    retryCount.current++
    if (retryCount.current >= 2) {
      navigate(returnPath.current, { replace: true })
      return
    }
    setStatus("loading")
    setStorageIssue(false)
    setOauthError(null)
    tryCreateSession()
  }

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
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <p className="text-lg font-semibold text-red-400">Authentication failed</p>

        {oauthError ? (
          <>
            <p className="max-w-md text-sm leading-relaxed text-white/50">
              Discord sign-in did not complete successfully.
            </p>
            <div className="max-w-md rounded-lg border border-red-500/15 bg-red-500/5 px-4 py-3 text-left text-sm text-red-300/80">
              <p className="font-medium text-red-300">
                {oauthError.message}
              </p>
              {oauthError.code && (
                <p className="mt-1 text-xs text-red-400/50">
                  Code: {oauthError.code}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="max-w-md text-sm leading-relaxed text-white/40">
              {storageIssue
                ? "Your browser's privacy settings are blocking site storage or cookies. This prevents sign-in from working."
                : "The session could not be created. This may be caused by browser privacy settings, an ad blocker, or a network issue."}
            </p>
            {storageIssue && (
              <p className="max-w-md text-sm text-amber-300/80">
                {isPrivacyBrowserLikely()
                  ? "Opera GX / Brave's tracker or ad blocker may be preventing the form from working. Disable the blocker for this site, or switch to Chrome / Edge / Firefox."
                  : "Private browsing or an extension may be blocking cookies or site storage. Allow them for this site or try another browser."}
              </p>
            )}
          </>
        )}

        <div className="mt-2 flex items-center gap-3">
          {!oauthError && (
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          )}
          <button
            onClick={() => navigate(returnPath.current, { replace: true })}
            className="inline-flex items-center gap-2 rounded-md bg-white/5 px-4 py-2 text-sm text-white/50 hover:bg-white/10 transition-colors"
          >
            Go back
          </button>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-white/30">
          Still having trouble? Join
          <a
            href="https://discord.gg/outcraft"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand hover:underline"
          >
            discord.gg/outcraft
            <ExternalLink className="h-3 w-3" />
          </a>
          and open a ticket
        </p>
        <p className="mt-2 text-xs text-white/20">
          Or visit the{" "}
          <button
            onClick={() => navigate("/debug")}
            className="text-brand hover:underline"
          >
            debug page
          </button>{" "}
          to copy diagnostic info for support.
        </p>
      </div>
    )
  }

  return null
}
