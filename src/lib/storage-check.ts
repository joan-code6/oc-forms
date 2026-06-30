export interface StorageStatus {
  localStorage: boolean
  sessionStorage: boolean
  cookies: boolean
}

function testStorage(type: "localStorage" | "sessionStorage"): boolean {
  try {
    const storage = window[type]
    const testKey = "__storage_test__"
    storage.setItem(testKey, "1")
    storage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

function testCookies(): boolean {
  try {
    const testKey = "__cookie_test__=1"
    document.cookie = testKey + "; path=/"
    return document.cookie.includes("__cookie_test__")
  } catch {
    return false
  }
}

export function checkStorage(): StorageStatus {
  return {
    localStorage: testStorage("localStorage"),
    sessionStorage: testStorage("sessionStorage"),
    cookies: testCookies(),
  }
}

export function isPrivacyBrowserLikely(): boolean {
  const ua = navigator.userAgent.toLowerCase()
  const isOperaGx = ua.includes("opr/") || ua.includes("opera gx") || (ua.includes("opera") && ua.includes("gx"))
  const isBrave = (navigator as unknown as Record<string, unknown>).brave !== undefined
  const isFirefox =
    ua.includes("firefox") && !ua.includes("seamonkey") && !ua.includes("focus") && !ua.includes("fxios")
  const isSafari = ua.includes("safari") && !ua.includes("chrome") && !ua.includes("chromium")
  return isOperaGx || isBrave || isFirefox || isSafari
}

export function isThirdPartyCookieBlockLikely(): boolean {
  if (isPrivacyBrowserLikely()) return true
  const storage = checkStorage()
  return storage.localStorage && storage.cookies
}

export function isAppwriteCrossOrigin(): boolean {
  try {
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1"
    const endpointUrl = new URL(endpoint)
    return endpointUrl.origin !== window.location.origin
  } catch {
    return true
  }
}

export function getBrowserHint(): string {
  const ua = navigator.userAgent.toLowerCase()
  const isBrave = (navigator as unknown as Record<string, unknown>).brave !== undefined
  if (isBrave) {
    return "In Brave, open Shields (lion icon) and turn off 'Block cross-site trackers' for this site, or switch to Chrome / Edge."
  }
  if (ua.includes("firefox") && !ua.includes("seamonkey")) {
    return "In Firefox, disable Enhanced Tracking Protection (shield icon in address bar) for this site, or switch to Chrome / Edge."
  }
  if (ua.includes("safari") && !ua.includes("chrome")) {
    return "In Safari, disable 'Prevent cross-site tracking' in Preferences > Privacy, or switch to Chrome / Edge."
  }
  if (ua.includes("opr/") || ua.includes("opera")) {
    return "In Opera / Opera GX, disable the ad blocker and tracker blocker for this site, or switch to Chrome / Edge."
  }
  return "Disable any ad blocker or tracking protection for this site, or switch to Chrome / Edge."
}
