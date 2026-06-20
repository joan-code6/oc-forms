import { ExecutionStatus } from "appwrite"
import { getAccount } from "@/lib/appwrite"

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1"
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || ""

export async function callFunction<T = unknown>(
  functionId: string,
  body?: Record<string, unknown>
): Promise<T> {
  const headers: Record<string, string> = {
    "X-Appwrite-Project": PROJECT_ID,
    "Content-Type": "application/json",
  }

  try {
    const account = getAccount()
    const jwt = await account.createJWT()
    if (jwt?.jwt) {
      headers["X-Appwrite-JWT"] = jwt.jwt
      console.log("[callFunction] JWT set successfully")
    } else {
      console.warn("[callFunction] createJWT returned no jwt value")
    }
  } catch (e) {
    console.warn("[callFunction] createJWT failed:", e)
  }

  const res = await fetch(`${ENDPOINT}/functions/${functionId}/executions`, {
    method: "POST",
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  if (data.status === ExecutionStatus.Failed) {
    throw new Error(data.errors || "Function execution failed.")
  }

  if (data.status !== ExecutionStatus.Completed) {
    throw new Error(`Function execution did not complete (status: ${data.status}).`)
  }

  if (data.responseStatusCode >= 400) {
    const message = extractErrorMessage(data.responseBody, data.responseStatusCode)
    throw new Error(message)
  }

  if (!data.responseBody) {
    throw new Error("No response from server.")
  }

  return JSON.parse(data.responseBody) as T
}

function extractErrorMessage(body: string, statusCode: number): string {
  if (!body) return `Server error (${statusCode})`
  try {
    const parsed = JSON.parse(body) as { error?: string }
    return parsed.error || `Server error (${statusCode})`
  } catch {
    return `Server error (${statusCode})`
  }
}
