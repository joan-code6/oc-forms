import { Functions, ExecutionStatus } from "appwrite"
import type { Models } from "appwrite"
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

  return handleExecutionResponse<T>(res)
}

export async function callFunctionAsync(
  functionId: string,
  body?: Record<string, unknown>
): Promise<string> {
  const res = await functions.createExecution({
    functionId,
    body: body ? JSON.stringify(body) : undefined,
    async: true,
  })
  return res.$id
}

export async function pollExecution(
  functionId: string,
  executionId: string,
  pollIntervalMs = 3000
): Promise<Models.Execution> {
  while (true) {
    const execution = await functions.getExecution({
      functionId,
      executionId,
    })

    if (execution.status === ExecutionStatus.Completed || execution.status === ExecutionStatus.Failed) {
      return execution
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
}

export async function pollAndParseExecution<T = unknown>(
  functionId: string,
  executionId: string,
  pollIntervalMs = 3000
): Promise<T> {
  const execution = await pollExecution(functionId, executionId, pollIntervalMs)
  return handleExecutionResponse<T>(execution)
}

function handleExecutionResponse<T>(execution: Models.Execution): T {
  if (execution.status === ExecutionStatus.Failed) {
    throw new Error(execution.errors || "Function execution failed.")
  }

  if (execution.status !== ExecutionStatus.Completed) {
    throw new Error(`Function execution did not complete (status: ${execution.status}).`)
  }

  if (execution.responseStatusCode >= 400) {
    const message = extractErrorMessage(execution.responseBody, execution.responseStatusCode)
    throw new Error(message)
  }

  if (!execution.responseBody) {
    throw new Error("No response from server.")
  }

  return JSON.parse(execution.responseBody) as T
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
