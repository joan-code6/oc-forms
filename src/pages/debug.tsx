import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardCheck, ClipboardCopy, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { getClient, getSession } from "@/lib/appwrite"
import { checkStorage } from "@/lib/storage-check"

function collectDebugInfo(): Record<string, unknown> {
  const storage = checkStorage()
  const appwriteClient = getClient()
  const nav = navigator as unknown as Record<string, unknown>
  const conn = (nav.connection || {}) as Record<string, unknown>
  const clientCfg = (appwriteClient as unknown as Record<string, unknown>).config as Record<string, unknown> | undefined

  let sessionSecretExists = false
  let sessionSecretLength = 0
  let authErrorCount = 0

  try {
    const stored = localStorage.getItem("outcraft-appwrite-session-secret")
    sessionSecretExists = !!stored
    sessionSecretLength = stored?.length || 0
  } catch { /* ignore */ }

  try {
    const stored = sessionStorage.getItem("outcraft-appwrite-session-secret-session")
    if (!sessionSecretExists && stored) {
      sessionSecretExists = true
      sessionSecretLength = stored.length
    }
  } catch { /* ignore */ }

  try {
    authErrorCount = parseInt(localStorage.getItem("outcraft-auth-error-count") || "0", 10) || 0
  } catch { /* ignore */ }

  return {
    time: new Date().toISOString(),
    url: window.location.href,
    referrer: document.referrer || "(none)",

    browser: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      languages: navigator.languages?.join(", "),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      online: navigator.onLine,
      connectionType: conn.effectiveType || "unknown",
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
    },

    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      orientation: screen.orientation?.type || "unknown",
    },

    storage: {
      localStorage: storage.localStorage,
      sessionStorage: storage.sessionStorage,
      cookies: storage.cookies,
    },

    appwrite: {
      endpoint: clientCfg?.endpoint || "unknown",
      project: clientCfg?.project || "unknown",
    },

    auth: {
      sessionSecretStored: sessionSecretExists,
      sessionSecretLength,
      authErrorCount,
      sessionValid: null as boolean | null,
    },
  }
}

export function DebugPage() {
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)

  const handleCollect = useCallback(async () => {
    setChecking(true)
    const data = collectDebugInfo()

    try {
      const session = await Promise.race([
        getSession(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ])
      ;(data.auth as Record<string, unknown>).sessionValid = !!session
    } catch {
      ;(data.auth as Record<string, unknown>).sessionValid = false
    }

    setInfo(data)
    setChecking(false)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!info) return
    const text = JSON.stringify(info, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Debug info copied to clipboard")
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error("Failed to copy. Please select and copy the text manually.")
    }
  }, [info])

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-bold text-white">Debug Information</h1>
            <p className="text-sm text-white/50">
              Click the button below to collect diagnostic information about your
              browser and authentication state. No personal data is included.
            </p>
          </div>

          <div className="mt-6 flex flex-col items-center gap-4">
            {!info ? (
              <Button
                onClick={handleCollect}
                disabled={checking}
                size="lg"
                className="gap-2"
              >
                {checking ? "Collecting..." : "Collect Debug Info"}
              </Button>
            ) : (
              <>
                <div className="w-full rounded-lg border border-white/10 bg-white/5 p-4">
                  <pre className="max-h-[50vh] overflow-auto text-xs text-white/70 whitespace-pre-wrap break-all font-mono">
                    {JSON.stringify(info, null, 2)}
                  </pre>
                </div>
                <Button
                  onClick={handleCopy}
                  variant={copied ? "outline" : "default"}
                  size="lg"
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <ClipboardCheck className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="h-4 w-4" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
              </>
            )}
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-white/30">
            Paste the copied info in your ticket at
            <a
              href="https://discord.gg/outcraft"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand hover:underline"
            >
              discord.gg/outcraft
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
