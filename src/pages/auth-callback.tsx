import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2, AlertTriangle, RefreshCw, ExternalLink, Mail, ShieldAlert } from "lucide-react"
import { createSessionAndStore, getCurrentUser, discordLogin } from "@/lib/appwrite"
import { captureOAuthError } from "@/lib/posthog"

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

function isMissingEmailError(message: string | null): boolean {
  if (!message) return false
  const lower = message.toLowerCase()
  return lower.includes("email") || lower.includes("e-mail")
}

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnPath = useRef(getReturnPath(searchParams))
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading")
  const [storageIssue, setStorageIssue] = useState(false)
  const [oauthError, setOauthError] = useState<{ message: string; code?: string } | null>(null)
  const [missingEmail, setMissingEmail] = useState(false)
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
      const message = errorMsg || "Discord authentication was denied or failed."

      captureOAuthError(message, errorCode || undefined)

      if (isMissingEmailError(errorMsg)) {
        setMissingEmail(true)
        setStatus("error")
        return
      }

      setOauthError({
        message,
        code: errorCode || undefined,
      })
      setStatus("error")
      return
    }

    if (userId && secret) {
      createSessionAndStore(userId, secret)
        .then((session) => {
          if (session) {
            navigate(returnPath.current, { replace: true })
          } else {
            setStorageIssue(true)
            setStatus("error")
          }
        })
        .catch(() => setStatus("error"))
      return
    }

    getCurrentUser()
      .then((user) => {
        if (user) {
          navigate(returnPath.current, { replace: true })
        } else {
          setStatus("error")
        }
      })
      .catch(() => setStatus("error"))
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
    if (missingEmail) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
            <Mail className="h-7 w-7 text-amber-400" />
          </div>
          <p className="text-lg font-semibold text-amber-400">Email Required</p>
          <p className="max-w-md text-sm leading-relaxed text-white/60">
            Discord did not share a verified email address with us. This usually
            happens when your Discord account was created with a phone number, or
            your email hasn&apos;t been verified yet.
          </p>
          <div className="max-w-md rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-left text-sm">
            <p className="font-medium text-amber-300/90">How to fix this:</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-amber-200/60">
              <li>
                Open your{" "}
                <a
                  href="https://discord.com/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  Discord settings
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                and add or verify an email address.
              </li>
              <li>Return here and click &quot;Try Again&quot; below.</li>
            </ol>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => {
                setStatus("loading")
                setMissingEmail(false)
                discordLogin(returnPath.current)
              }}
              className="inline-flex items-center gap-2 rounded-md bg-amber-500/20 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <button
              onClick={() => navigate(returnPath.current, { replace: true })}
              className="inline-flex items-center gap-2 rounded-md bg-white/5 px-4 py-2 text-sm text-white/50 hover:bg-white/10 transition-colors"
            >
              Go back
            </button>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-white/30">
            Still stuck? Join
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
        </div>
      )
    }

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
          {oauthError ? (
            <ShieldAlert className="h-7 w-7 text-red-400" />
          ) : (
            <AlertTriangle className="h-7 w-7 text-red-400" />
          )}
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
                : "The session could not be established. This may be caused by browser privacy settings, an ad blocker, or a network issue."}
            </p>
            {storageIssue && (
              <p className="max-w-md text-sm text-amber-300/80">
                In Firefox, disable Enhanced Tracking Protection for this site, or try Chrome / Edge.
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
