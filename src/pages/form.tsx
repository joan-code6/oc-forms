import { useCallback, useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { WelcomeCard } from "@/components/form/welcome-card"
import { UsernameCard } from "@/components/form/username-card"
import { TimezoneCard } from "@/components/form/timezone-card"
import { AvatarCard } from "@/components/form/avatar-card"
import { YesNoTableCard } from "@/components/form/yes-no-table-card"
import { DropdownCard } from "@/components/form/dropdown-card"
import { TextQuestionsCard } from "@/components/form/text-questions-card"
import { SubmitSuccessCard } from "@/components/form/submit-success-card"
import { FormProvider, useForm } from "@/hooks/use-form-state"
import { useAppwriteAuth } from "@/hooks/use-appwrite-auth"
import { useSubmitApplication } from "@/hooks/use-appwrite-submit"
import { useMinecraftValidation } from "@/hooks/use-minecraft-validation"
import { toast } from "sonner"
import { LogIn } from "lucide-react"

export const FORM_VERSION = "v1"
const SUBMITTED_KEY = `outcraft-submitted-${FORM_VERSION}`

function getAlreadySubmitted(): boolean {
  try {
    return localStorage.getItem(SUBMITTED_KEY) === "true"
  } catch {
    return false
  }
}

function FormLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <Skeleton className="h-20 w-20 rounded-2xl" />
              <Skeleton className="h-8 w-32" />
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-80" />
            <Skeleton className="h-11 w-full max-w-md" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-56 w-40 mx-auto" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-11 w-full max-w-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FormContent() {
  const [minecraftValid, setMinecraftValid] = useState(false)
  const [alreadySubmitted] = useState(getAlreadySubmitted)
  const { state, dispatch, validate } = useForm()
  const { user, loading, error, loginWithDiscord } = useAppwriteAuth()
  const submitMutation = useSubmitApplication()

  const { data: minecraftData } = useMinecraftValidation(state.minecraftIGN)

  useEffect(() => {
    if (state.submitted) {
      try {
        localStorage.setItem(SUBMITTED_KEY, "true")
      } catch { /* ignore */ }
    }
  }, [state.submitted])

  const isFormReady = !!user && !loading

  const handleSubmit = useCallback(() => {
    if (!isFormReady || !user) {
      toast.error("Please verify your Discord account first.")
      return
    }

    if (!validate()) {
      const firstError = document.querySelector("[data-validation-error]")
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      toast.error("Please fix the errors in the form.")
      return
    }

    if (!minecraftValid || minecraftData?.success !== true) {
      toast.error("Please enter a valid Minecraft username that exists.")
      return
    }

    dispatch({ type: "SET_SUBMITTING", value: true })

    const { q3: _, q4: __, ...backendYesNoAnswers } = state.yesNoAnswers

    submitMutation.mutate(
      {
        minecraftIGN: state.minecraftIGN.trim(),
        timezone: state.timezone,
        yesNoAnswers: backendYesNoAnswers,
        textAnswers: state.textAnswers,
        dropdownAnswers: state.dropdownAnswers,
      },
      {
        onSuccess: (result) => {
          dispatch({ type: "SET_SUBMITTING", value: false })
          if (result.success) {
            dispatch({ type: "SET_SUBMITTED", value: true })
            sessionStorage.removeItem("outcraft-form")
            toast.success("Application submitted successfully!")
          } else {
            toast.error(result.error || "Failed to submit application.")
          }
        },
        onError: (err) => {
          dispatch({ type: "SET_SUBMITTING", value: false })
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to submit application. Please try again."
          )
        },
      }
    )
  }, [
    isFormReady,
    user,
    validate,
    minecraftValid,
    minecraftData,
    dispatch,
    submitMutation,
    state,
  ])

  if (loading) {
    return <FormLoadingSkeleton />
  }

  if (alreadySubmitted || state.submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <SubmitSuccessCard
          isSubmitting={false}
          submitted={true}
          disabled={false}
          onSubmit={() => {}}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-24 pt-8 md:pt-12">
      <Card className="form-card animate-in" style={{ animationDelay: "0ms" }}>
        <CardContent className="p-6">
          <WelcomeCard
            user={user}
            loading={loading}
            error={error}
            onLogin={loginWithDiscord}
          />
        </CardContent>
      </Card>

      <Card className="form-card animate-in" style={{ animationDelay: "60ms" }}>
        <CardContent className="p-6">
          <UsernameCard />
        </CardContent>
      </Card>
      <Card className="form-card animate-in" style={{ animationDelay: "120ms" }}>
        <CardContent className="p-6">
          <AvatarCard
            minecraftUsername={state.minecraftIGN}
            onValidationChange={setMinecraftValid}
          />
        </CardContent>
      </Card>

      <Card className="form-card animate-in" style={{ animationDelay: "180ms" }}>
        <CardContent className="p-6">
          <TimezoneCard />
        </CardContent>
      </Card>

      <Card className="form-card animate-in" style={{ animationDelay: "240ms" }}>
        <CardContent className="p-6">
          <YesNoTableCard />
        </CardContent>
      </Card>

      <Card className="form-card animate-in" style={{ animationDelay: "300ms" }}>
        <CardContent className="p-6">
          <DropdownCard />
        </CardContent>
      </Card>

      <Card className="form-card animate-in" style={{ animationDelay: "360ms" }}>
        <CardContent className="p-6">
          <TextQuestionsCard />
        </CardContent>
      </Card>

      {state.validationErrors.length > 0 && (
        <div className="animate-in rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 border-l-4 border-l-red-500" data-validation-error>
          <ul className="list-inside list-disc space-y-1">
            {state.validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-card animate-in" style={{ animationDelay: "420ms" }}>
        <SubmitSuccessCard
          isSubmitting={state.isSubmitting}
          submitted={state.submitted}
          disabled={!isFormReady}
          onSubmit={handleSubmit}
        />
      </div>

      {!user && (
        <div className="animate-in flex items-center justify-center gap-2 rounded-lg border border-brand/20 bg-brand/5 px-4 py-3 text-center text-sm text-white/50" style={{ animationDelay: "480ms" }}>
          <LogIn className="h-4 w-4 text-brand" />
          You must verify with Discord before you can submit.
        </div>
      )}
    </div>
  )
}

export function FormPage() {
  return (
    <FormProvider>
      <FormContent />
    </FormProvider>
  )
}
