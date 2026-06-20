import { Functions, ExecutionStatus } from "appwrite"
import { getClient } from "@/lib/appwrite"

const functions = new Functions(getClient())

export async function callFunction<T = unknown>(
  functionId: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await functions.createExecution({
    functionId,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === ExecutionStatus.Failed) {
    throw new Error(res.errors || "Function execution failed.")
  }

  if (res.status !== ExecutionStatus.Completed) {
    throw new Error(`Function execution did not complete (status: ${res.status}).`)
  }

  if (res.responseStatusCode >= 400) {
    const message = extractErrorMessage(res.responseBody, res.responseStatusCode)
    throw new Error(message)
  }

  if (!res.responseBody) {
    throw new Error("No response from server.")
  }

  return JSON.parse(res.responseBody) as T
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
