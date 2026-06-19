import { Client, Account, OAuthProvider } from "appwrite"

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1"
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || ""

let client: Client
let account: Account

function getClient(): Client {
  if (!client) {
    client = new Client()
    client.setEndpoint(ENDPOINT).setProject(PROJECT_ID)
  }
  return client
}

export function getAccount(): Account {
  if (!account) {
    account = new Account(getClient())
  }
  return account
}

export function discordLogin() {
  const redirectUrl = `${window.location.origin}/auth/callback`
  const acc = getAccount()
  acc.createOAuth2Session(OAuthProvider.Discord, redirectUrl, redirectUrl)
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
}
