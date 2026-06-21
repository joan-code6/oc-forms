import { useState, useEffect, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction } from "@/lib/functions"
import { ChevronRight, ArrowLeft, AlertTriangle } from "lucide-react"

const NEXT_APP_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_NEXT_APP_ID || "get-next-application"
const RATING_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_RATING_ID || "submit-application-rating"

interface ApplicationData {
  id: string
  minecraftIGN: string
  skinUrl: string
  discordUsername: string
  discordRoles: string[]
  discordRolesUnavailable: boolean
  timezone: string
  createdAt: string
  status: string
  answers: { question: string; answer: string }[]
}

interface NextAppResult {
  application: ApplicationData | null
  error?: string
}

interface RatingResult {
  success: boolean
  error?: string
}

function getRatingZone(value: number): "red" | "orange" | "yellow" | "green" {
  if (value <= 25) return "red"
  if (value <= 50) return "orange"
  if (value <= 75) return "yellow"
  return "green"
}

function getSliderBackground(): string {
  return "linear-gradient(to right, #ef4444 0%, #ef4444 25%, #f97316 25%, #f97316 50%, #eab308 50%, #eab308 75%, #22c55e 75%, #22c55e 100%)"
}

export function ModeratorReviewPage() {
  const { allowed, loading: accessLoading } = useModeratorAccess()
  const navigate = useNavigate()
  const location = useLocation()
  const passedApplicationId = (location.state as { applicationId?: string })?.applicationId

  const [application, setApplication] = useState<ApplicationData | null>(null)
  const [loadingApp, setLoadingApp] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [hasSelected, setHasSelected] = useState(false)
  const [moderatorNote, setModeratorNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadApplication = useCallback(async (targetId?: string) => {
    setLoadingApp(true)
    setLoadError(null)
    try {
      const result = await callFunction<NextAppResult>(NEXT_APP_FUNCTION_ID, {
        applicationId: targetId,
      })
      setApplication(result.application)
      if (!result.application && !targetId) {
        setLoadError("No more applications to review.")
      } else if (!result.application && targetId) {
        setLoadError("Application not found or already reviewed.")
      }
    } catch (e) {
      setApplication(null)
      setLoadError(e instanceof Error ? e.message : "Failed to load application.")
    } finally {
      setLoadingApp(false)
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    callFunction<NextAppResult>(NEXT_APP_FUNCTION_ID, {
      applicationId: passedApplicationId,
    })
      .then((result) => {
        if (cancelled) return
        setApplication(result.application)
        if (!result.application && !passedApplicationId) {
          setLoadError("No more applications to review.")
        } else if (!result.application && passedApplicationId) {
          setLoadError("Application not found or already reviewed.")
        }
      })
      .catch((e) => {
        if (cancelled) return
        setApplication(null)
        setLoadError(e instanceof Error ? e.message : "Failed to load application.")
      })
      .finally(() => {
        if (!cancelled) setLoadingApp(false)
      })
    return () => { cancelled = true }
  }, [allowed, passedApplicationId])

  const handleSliderChange = (value: number) => {
    setRating(value)
    setHasSelected(true)
  }

  const handleSubmit = async () => {
    if (!application || rating === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await callFunction<RatingResult>(RATING_FUNCTION_ID, {
        applicationId: application.id,
        rating,
        moderatorNote: moderatorNote.trim() || undefined,
      })

      if (result.success) {
        setRating(null)
        setHasSelected(false)
        setModeratorNote("")
        await loadApplication()
      } else {
        setSubmitError(result.error || "Failed to save rating.")
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to save rating.")
    } finally {
      setSubmitting(false)
    }
  }

  if (accessLoading || !allowed) return null

  if (loadingApp) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-40" />
          </div>
        </div>
      </div>
    )
  }

  if (loadError || !application) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <Card>
          <CardContent className="p-8 space-y-4">
            {loadError && (
              <div className="flex items-center justify-center gap-2 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4" />
                {loadError}
              </div>
            )}
            {!loadError && (
              <p className="text-lg text-white/60">No applications to review.</p>
            )}
            <Button variant="outline" onClick={() => navigate("/moderator")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const zone = hasSelected && rating !== null ? getRatingZone(rating) : null

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/moderator")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Review Application</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          {application.answers.map((a, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <p className="mb-1 text-sm font-medium text-white/70">
                  {a.question}
                </p>
                <p className="whitespace-pre-wrap text-sm text-white">{a.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4 sm:sticky sm:top-12 sm:self-start">
          <Card>
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <img
                src={application.skinUrl}
                alt={`${application.minecraftIGN} skin`}
                className="h-40 w-auto rounded-lg"
              />
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Minecraft</span>
                  <span className="font-medium text-white">
                    {application.minecraftIGN}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Discord</span>
                  <span className="font-medium text-white">
                    {application.discordUsername}
                  </span>
                </div>
                {application.discordRoles.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-white/50">Guild Roles</span>
                    <div className="flex flex-wrap gap-1">
                      {application.discordRoles.map((role) => (
                        <span
                          key={role}
                          className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/70"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {application.discordRoles.length === 0 && application.discordRolesUnavailable && (
                  <div className="flex flex-col gap-1">
                    <span className="text-white/50">Guild Roles</span>
                    <span className="text-xs text-white/40">Could not load roles</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/50">Timezone</span>
                  <span className="font-medium text-white">
                    {application.timezone}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Applied</span>
                  <span className="font-medium text-white">
                    {new Date(application.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4">
            {!hasSelected && (
              <p className="text-sm text-white/40">
                Drag the slider to select a rating
              </p>
            )}
            <div className="w-full max-w-xl">
              <input
                type="range"
                min={0}
                max={100}
                value={rating ?? 50}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                onTouchEnd={(e) => {
                  const target = e.target as HTMLInputElement
                  handleSliderChange(Number(target.value))
                }}
                className="moderator-range-slider w-full"
                style={{
                  background: getSliderBackground(),
                  height: "8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              />
              <div className="mt-2 flex justify-between text-xs text-white/40">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-2xl font-bold"
                style={{
                  color: zone
                    ? zone === "red"
                      ? "#ef4444"
                      : zone === "orange"
                        ? "#f97316"
                        : zone === "yellow"
                          ? "#eab308"
                          : "#22c55e"
                    : "white",
                }}
              >
                {hasSelected ? `${rating}%` : "—%"}
              </span>
            </div>

            <div className="w-full max-w-xl space-y-2">
              <label htmlFor="moderatorNote" className="text-sm text-white/60">
                Moderator Note <span className="text-white/30">(optional)</span>
              </label>
              <textarea
                id="moderatorNote"
                value={moderatorNote}
                onChange={(e) => setModeratorNote(e.target.value)}
                placeholder="Leave a note about this application..."
                rows={3}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
              />
            </div>

            {submitError && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {submitError}
              </div>
            )}

            <Button
              className="w-full max-w-xl"
              size="lg"
              disabled={!hasSelected || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Saving..." : "Continue"}
              {!submitting && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
