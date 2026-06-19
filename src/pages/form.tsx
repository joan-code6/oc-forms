import { useCallback, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
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

function FormContent() {
  const [minecraftValid, setMinecraftValid] = useState(false)
  const { state, dispatch, validate } = useForm()
  const { user, loading, error, loginWithDiscord } = useAppwriteAuth()
  const submitMutation = useSubmitApplication()

  const { data: minecraftData } = useMinecraftValidation(state.minecraftIGN)

  const isFormReady = !!user && !loading

  const handleSubmit = useCallback(() => {
    if (!isFormReady || !user) {
      toast.error("Please verify your Discord account first.")
      return
    }

    if (!validate()) {
      toast.error("Please fix the errors in the form.")
      return
    }

    if (!minecraftValid || minecraftData?.success !== true) {
      toast.error("Please enter a valid Minecraft username that exists.")
      return
    }

    dispatch({ type: "SET_SUBMITTING", value: true })

    submitMutation.mutate(
      {
        minecraftIGN: state.minecraftIGN.trim(),
        timezone: state.timezone,
        yesNoAnswers: state.yesNoAnswers,
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-24">
      <Card>
        <CardContent className="p-6">
          <WelcomeCard
            user={user}
            loading={loading}
            error={error}
            onLogin={loginWithDiscord}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <UsernameCard />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <AvatarCard
            minecraftUsername={state.minecraftIGN}
            onValidationChange={setMinecraftValid}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <TimezoneCard />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <YesNoTableCard />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <DropdownCard />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <TextQuestionsCard />
        </CardContent>
      </Card>

      {state.validationErrors.length > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <ul className="list-inside list-disc space-y-1">
            {state.validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <SubmitSuccessCard
        isSubmitting={state.isSubmitting}
        submitted={state.submitted}
        disabled={!isFormReady}
        onSubmit={handleSubmit}
      />

      {!user && !loading && (
        <div className="text-center text-xs text-white/30">
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
