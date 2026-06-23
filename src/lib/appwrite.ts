import { Client, Account, OAuthProvider, type Models } from "appwrite"

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1"
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || ""
const SESSION_SECRET_KEY = "outcraft-appwrite-session-secret"

let client: Client
let account: Account

function loadStoredSessionSecret(): string | null {
  try {
    return localStorage.getItem(SESSION_SECRET_KEY)
  } catch {
    return null
  }
}

export function storeSessionSecret(secret: string) {
  try {
    localStorage.setItem(SESSION_SECRET_KEY, secret)
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
  const stateParam = returnTo || window.location.pathname
  const redirectUrl = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(stateParam)}`
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
}

export async function createSessionAndStore(userId: string, secret: string): Promise<Models.Session | null> {
  try {
    const acc = getAccount()
    const session = await acc.createSession({ userId, secret })
    if (session.secret) {
      storeSessionSecret(session.secret)
      applySessionSecret(session.secret)
    }
    return session
  } catch {
    return null
  }
}
