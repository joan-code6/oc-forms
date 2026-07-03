import { useState, useCallback } from "react"
import { initPostHog, disablePostHog } from "@/lib/posthog"

const STORAGE_KEY = "oc_cookie_consent"

function getStoredConsent(): boolean | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "accepted") return true
    if (stored === "declined") return false
    return null
  } catch {
    return null
  }
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<boolean | null>(getStoredConsent)

  const accept = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "accepted")
    initPostHog()
    setConsent(true)
  }, [])

  const decline = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "declined")
    disablePostHog()
    setConsent(false)
  }, [])

  return { consent, accept, decline }
}
