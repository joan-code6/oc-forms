import { Client, Account, OAuthProvider, type Models } from "appwrite"

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1"
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || ""
const SESSION_SECRET_KEY = "outcraft-appwrite-session-secret"
const SESSION_SECRET_SESSION_KEY = "outcraft-appwrite-session-secret-session"
const SESSION_COOKIES_KEY = "outcraft-appwrite-session-cookies"
const AUTH_ERROR_COUNT_KEY = "outcraft-auth-error-count"
const AUTH_ERROR_THRESHOLD = 3

const ENDPOINT_ORIGIN = (() => { try { return new URL(ENDPOINT).origin } catch { return ENDPOINT } })()

let client: Client
let account: Account
let sessionCookies: Record<string, string> | null = null
let fetchPatched = false

function installFetchPatch() {
  if (fetchPatched) return
  fetchPatched = true

  function hasFallbackCookie(headers: HeadersInit | undefined): boolean {
    if (!headers) return false
    if (headers instanceof Headers) {
      return headers.has("x-fallback-cookies")
    }
    if (Array.isArray(headers)) {
      return headers.some(([k]) => k.toLowerCase() === "x-fallback-cookies")
    }
    return Object.keys(headers).some((k) => k.toLowerCase() === "x-fallback-cookies")
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input)
    if (sessionCookies && url.startsWith(ENDPOINT_ORIGIN) && !hasFallbackCookie(init?.headers)) {
      init = { ...init }
      init.headers = new Headers(init.headers)
      init.headers.set("x-fallback-cookies", JSON.stringify(sessionCookies))
    }
    return originalFetch(input, init)
  }
}

function loadStoredSessionCookies(): Record<string, string> | null {
  try {
    const stored = localStorage.getItem(SESSION_COOKIES_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  try {
    const stored = sessionStorage.getItem(SESSION_COOKIES_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return null
}

function storeSessionCookies(cookiesJson: string) {
  sessionCookies = JSON.parse(cookiesJson)
  try { localStorage.setItem(SESSION_COOKIES_KEY, cookiesJson) } catch { /* ignore */ }
  try { sessionStorage.setItem(SESSION_COOKIES_KEY, cookiesJson) } catch { /* ignore */ }
}

function clearSessionCookies() {
  sessionCookies = null
  try { localStorage.removeItem(SESSION_COOKIES_KEY) } catch { /* ignore */ }
  try { sessionStorage.removeItem(SESSION_COOKIES_KEY) } catch { /* ignore */ }
}

sessionCookies = loadStoredSessionCookies()
if (sessionCookies) installFetchPatch()

function loadStoredSessionSecret(): string | null {
  try {
    const stored = localStorage.getItem(SESSION_SECRET_KEY)
    if (stored) return stored
  } catch { /* ignore */ }
  try {
    const stored = sessionStorage.getItem(SESSION_SECRET_SESSION_KEY)
    if (stored) return stored
  } catch { /* ignore */ }
  return null
}

export function storeSessionSecret(secret: string) {
  try {
    localStorage.setItem(SESSION_SECRET_KEY, secret)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(SESSION_SECRET_SESSION_KEY, secret)
  } catch {
    /* ignore */
  }
}

export function clearStoredSessionSecret() {
  try {
    localStorage.removeItem(SESSION_SECRET_KEY)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(SESSION_SECRET_SESSION_KEY)
  } catch {
    /* ignore */
  }
  clearSessionCookies()
}

export function applySessionSecret(secret: string) {
  try {
    getClient().setSession(secret)
  } catch {
    /* ignore */
  }
}

export function getClient(): Client {
  if (!client) {
    client = new Client()
    client.setEndpoint(ENDPOINT).setProject(PROJECT_ID)
    const stored = loadStoredSessionSecret()
    if (stored) {
      client.setSession(stored)
    }
  }
  return client
}

export function getAccount(): Account {
  if (!account) {
    account = new Account(getClient())
  }
  return account
}

export function discordLogin(returnTo?: string) {
  const returnPath = returnTo || window.location.pathname
  try { sessionStorage.setItem("auth_return_to", returnPath) } catch { /* ignore */ }
  try { localStorage.setItem("auth_return_to", returnPath) } catch { /* ignore */ }
  const redirectUrl = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnPath)}`
  const acc = getAccount()
  acc.createOAuth2Token(OAuthProvider.Discord, redirectUrl, redirectUrl)
}

export async function getCurrentUser() {
  try {
    const acc = getAccount()
    return await acc.get()
  } catch {
    return null
  }
}

export async function getSession() {
  try {
    const acc = getAccount()
    return await acc.getSession("current")
  } catch {
    return null
  }
}

export async function logout() {
  const acc = getAccount()
  await acc.deleteSession("current")
  clearStoredSessionSecret()
  resetAuthErrorCount()
}

export async function createSessionAndStore(userId: string, secret: string): Promise<Models.Session | null> {
  try {
    clearSessionCookies()

    const response = await fetch(`${ENDPOINT}/account/sessions/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": PROJECT_ID,
        "X-Appwrite-Response-Format": "1.6.0",
        "X-Fallback-Cookies": window.location.origin,
      },
      body: JSON.stringify({ userId, secret }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      if (import.meta.env.DEV) {
        console.error("[appwrite] createSession failed:", response.status, err)
      }
      incrementAuthErrorCount()
      return null
    }

    const session: Models.Session = await response.json()

    let sessionSecret = session.secret || ""

    if (!sessionSecret) {
      const fallbackCookies = response.headers.get("x-fallback-cookies")
      if (fallbackCookies) {
        try {
          const cookies = JSON.parse(fallbackCookies)
          for (const [name, value] of Object.entries(cookies)) {
            if (name.startsWith("a_session_")) {
              sessionSecret = String(value)
              storeSessionCookies(fallbackCookies)
              installFetchPatch()
              console.log("[appwrite] session established via x-fallback-cookies")
              break
            }
          }
        } catch (e) {
          console.warn("[appwrite] failed to parse x-fallback-cookies:", e)
        }
      }
    }

    if (sessionSecret) {
      storeSessionSecret(sessionSecret)
      applySessionSecret(sessionSecret)
      resetAuthErrorCount()
      return session
    }

    console.warn("[appwrite] session created server-side but no secret could be obtained client-side")
    return null
  } catch (e) {
    console.error("[appwrite] createSession network error:", e)
    incrementAuthErrorCount()
    return null
  }
}

function getAuthErrorCount(): number {
  try {
    return parseInt(localStorage.getItem(AUTH_ERROR_COUNT_KEY) || "0", 10) || 0
  } catch {
    return 0
  }
}

function incrementAuthErrorCount(): void {
  try {
    const current = getAuthErrorCount()
    localStorage.setItem(AUTH_ERROR_COUNT_KEY, String(current + 1))
  } catch {
    /* ignore */
  }
}

function resetAuthErrorCount(): void {
  try {
    localStorage.removeItem(AUTH_ERROR_COUNT_KEY)
  } catch {
    /* ignore */
  }
}

export function shouldShowHelpPopup(): boolean {
  const count = getAuthErrorCount()
  return count >= AUTH_ERROR_THRESHOLD && count % AUTH_ERROR_THRESHOLD === 0
}
