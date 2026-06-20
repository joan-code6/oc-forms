import { useMutation } from "@tanstack/react-query"
import { Functions } from "appwrite"
import { getClient } from "@/lib/appwrite"

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
      const functions = new Functions(getClient())
      const res = await functions.createExecution({
        functionId: FUNCTION_ID,
        body: JSON.stringify(payload),
      })

      if (!res.responseBody) {
        return { success: false, error: "No response from server." }
      }

      return JSON.parse(res.responseBody) as SubmitResult
    },
  })
}
