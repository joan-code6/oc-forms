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
  return isOperaGx || isBrave
}
