import { useCallback, useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { textQuestionPages, yesNoQuestions, dropdownQuestions } from "@/lib/questions"
import { toast } from "sonner"
import { LogIn, ArrowRight, ArrowLeft, PauseCircle } from "lucide-react"
import { BackgroundSlideshow } from "@/components/background-slideshow"
import { callFunction } from "@/lib/functions"

const TOTAL_PAGES = 6

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
  const [appsPaused, setAppsPaused] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const { state, dispatch, validate, isFormComplete } = useForm()
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

  useEffect(() => {
    let cancelled = false
    callFunction<{ appsPaused?: boolean }>("get-app-settings")
      .then((result) => {
        if (!cancelled) {
          setAppsPaused(!!result.appsPaused)
        }
      })
      .catch(() => {
        if (!cancelled) setAppsPaused(false)
      })
      .finally(() => {
        if (!cancelled) setCheckingStatus(false)
      })
    return () => { cancelled = true }
  }, [])

  const isFormReady = !!user && !loading
  const currentPage = state.currentPage

  const validatePage = useCallback((): boolean => {
    const errors: string[] = []

    if (currentPage === 2) {
      if (!state.minecraftIGN.trim() || state.minecraftIGN.trim().length < 3) {
        errors.push("Minecraft username must be at least 3 characters.")
      }
      if (!state.minecraftIGN.match(/^[a-zA-Z0-9_]+$/)) {
        errors.push("Minecraft username can only contain letters, numbers, and underscores.")
      }
    }

    if (currentPage === 3) {
      for (const q of yesNoQuestions) {
        if (state.yesNoAnswers[q.id] === null || state.yesNoAnswers[q.id] === undefined) {
          errors.push(`Please answer: "${q.text}"`)
        }
      }
      for (const q of dropdownQuestions) {
        if (!state.dropdownAnswers[q.id]) {
          errors.push(`Please select an option for: "${q.text}"`)
        }
      }
    }

    if (currentPage >= 4 && currentPage <= 6) {
      const pageQuestions = textQuestionPages[currentPage - 4]
      for (const q of pageQuestions) {
        if (!state.textAnswers[q.id]?.trim()) {
          errors.push(`Please fill in: "${q.text}"`)
        }
      }
    }

    dispatch({ type: "SET_ERRORS", errors })
    return errors.length === 0
  }, [currentPage, state, dispatch])

  const handleNext = useCallback(() => {
    if (currentPage === 1) {
      dispatch({ type: "SET_PAGE", page: 2 })
      return
    }

    if (!validatePage()) {
      const firstError = document.querySelector("[data-validation-error]")
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      toast.error("Please fix the errors before continuing.")
      return
    }

    if (currentPage < TOTAL_PAGES) {
      dispatch({ type: "SET_PAGE", page: currentPage + 1 })
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [currentPage, validatePage, dispatch])

  const handleBack = useCallback(() => {
    if (currentPage > 1) {
      dispatch({ type: "SET_PAGE", page: currentPage - 1 })
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [currentPage, dispatch])

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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { q3: _q3, q4: _q4, ...backendYesNoAnswers } = state.yesNoAnswers

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

  if (checkingStatus || loading) {
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

  if (appsPaused) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="form-card animate-in">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
              <PauseCircle className="h-8 w-8 text-amber-400" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-white">Applications Paused</h1>
            <p className="text-white/60">
              Applications are temporarily closed. Please check back later or join
              our Discord for updates.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-24 pt-8 md:pt-12">
      {/* Page 1: Welcome */}
      {currentPage === 1 && (
        <Card className="form-card animate-in">
          <CardContent className="p-6">
            <WelcomeCard
              user={user}
              loading={loading}
              error={error}
              onLogin={loginWithDiscord}
            />
          </CardContent>
        </Card>
      )}

      {/* Page 2: Username + Avatar + Timezone */}
      {currentPage === 2 && (
        <>
          <Card className="form-card animate-in">
            <CardContent className="p-6">
              <UsernameCard />
            </CardContent>
          </Card>
          <Card className="form-card animate-in">
            <CardContent className="p-6">
              <AvatarCard
                minecraftUsername={state.minecraftIGN}
                onValidationChange={setMinecraftValid}
              />
            </CardContent>
          </Card>
          <Card className="form-card animate-in">
            <CardContent className="p-6">
              <TimezoneCard />
            </CardContent>
          </Card>
        </>
      )}

      {/* Page 3: Short questions (Yes/No + Dropdown) */}
      {currentPage === 3 && (
        <>
          <Card className="form-card animate-in">
            <CardContent className="p-6">
              <YesNoTableCard />
            </CardContent>
          </Card>
          <Card className="form-card animate-in">
            <CardContent className="p-6">
              <DropdownCard />
            </CardContent>
          </Card>
        </>
      )}

      {/* Pages 4-6: Text questions */}
      {currentPage >= 4 && currentPage <= 6 && (
        <Card className="form-card animate-in">
          <CardContent className="p-6">
            <TextQuestionsCard
              questions={textQuestionPages[currentPage - 4]}
              title={
                currentPage === 4
                  ? "Experience & Goals"
                  : currentPage === 5
                    ? "Skills & Builds"
                    : "Kingdom & Availability"
              }
              description={
                currentPage === 4
                  ? "Tell us about your past experience and what you want to achieve."
                  : currentPage === 5
                    ? "Share your Minecraft skills and building ideas."
                    : "Describe your leadership style and availability."
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Validation errors */}
      {state.validationErrors.length > 0 && (
        <div className="animate-in rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 border-l-4 border-l-red-500" data-validation-error>
          <ul className="list-inside list-disc space-y-1">
            {state.validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {!user && (
        <div className="animate-in flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/50">
          <LogIn className="h-4 w-4 text-white/60" />
          You must verify with Discord before you can submit.
        </div>
      )}

      {/* Navigation buttons */}
      {currentPage < TOTAL_PAGES ? (
        <div className="flex items-center justify-between gap-4">
          {currentPage > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_PAGES }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i + 1 === currentPage
                    ? "w-6 bg-white"
                    : i + 1 < currentPage
                      ? "w-1.5 bg-white/50"
                      : "w-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>
          <Button
            type="button"
            onClick={handleNext}
            className="gap-2"
          >
            Next page
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_PAGES }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i + 1 === currentPage
                    ? "w-6 bg-white"
                    : i + 1 < currentPage
                      ? "w-1.5 bg-white/50"
                      : "w-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>
          <SubmitSuccessCard
            isSubmitting={state.isSubmitting}
            submitted={state.submitted}
            disabled={!isFormReady || !isFormComplete}
            onSubmit={handleSubmit}
          />
        </div>
      )}

      {isFormReady && !isFormComplete && currentPage === TOTAL_PAGES && (
        <div className="animate-in flex items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center text-sm text-amber-400/80">
          Please fill out all questions before submitting.
        </div>
      )}

    </div>
  )
}

export function FormPage() {
  const restoredRef = useRef(false)

  useEffect(() => {
    const body = document.body
    const originalBg = body.style.backgroundImage
    const originalColor = body.style.backgroundColor
    body.style.backgroundColor = "#0a0a0a"
    body.style.backgroundImage = "none"
    return () => {
      if (!restoredRef.current) {
        body.style.backgroundImage = originalBg
        body.style.backgroundColor = originalColor
      }
    }
  }, [])

  return (
    <FormProvider>
      <BackgroundSlideshow />
      <FormContent />
    </FormProvider>
  )
}
