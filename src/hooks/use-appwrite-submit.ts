import { useMutation } from "@tanstack/react-query"
import { Client, Functions } from "appwrite"

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || "")

const functions = new Functions(client)

const FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_SUBMIT_ID || "6a3573730031e3cd7861"

interface SubmitPayload {
  minecraftIGN: string
  timezone: string
  yesNoAnswers: Record<string, boolean | null>
  dropdownAnswers: Record<string, string | undefined>
  textAnswers: Record<string, string>
}

interface SubmitResult {
  success: boolean
  documentId?: string
  error?: string
}

export function useSubmitApplication() {
  return useMutation({
    mutationFn: async (payload: SubmitPayload): Promise<SubmitResult> => {
      const res = await functions.createExecution(
        FUNCTION_ID,
        JSON.stringify(payload)
      )

      if (!res.responseBody) {
        return { success: false, error: "No response from server." }
      }

      return JSON.parse(res.responseBody) as SubmitResult
    },
  })
}
