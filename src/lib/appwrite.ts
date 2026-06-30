import { Client, Account, OAuthProvider, type Models } from "appwrite"

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1"
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || ""
const SESSION_SECRET_KEY = "outcraft-appwrite-session-secret"
const SESSION_SECRET_SESSION_KEY = "outcraft-appwrite-session-secret-session"
const AUTH_ERROR_COUNT_KEY = "outcraft-auth-error-count"
const AUTH_ERROR_THRESHOLD = 3

let client: Client
let account: Account

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

    if (import.meta.env.DEV) {
      console.log("[appwrite] createSession response:", {
        $id: session.$id,
        userId: session.userId,
        hasSecret: !!session.secret,
        provider: session.provider,
        allKeys: Object.keys(session),
      })
    }

    let sessionSecret = session.secret || ""

    if (!sessionSecret) {
      const fallbackCookies = response.headers.get("x-fallback-cookies")
      if (fallbackCookies) {
        try {
          const cookies = JSON.parse(fallbackCookies)
          for (const [name, value] of Object.entries(cookies)) {
            if (name.startsWith("a_session_")) {
              sessionSecret = String(value)
              if (import.meta.env.DEV) {
                console.log("[appwrite] extracted session from x-fallback-cookies:", name)
              }
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
