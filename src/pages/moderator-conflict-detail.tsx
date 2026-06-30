import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction } from "@/lib/functions"
import { ArrowLeft, AlertTriangle, Gavel, Save } from "lucide-react"

const CONFLICT_DETAIL_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_CONFLICT_DETAIL_ID || ""
const RESOLVE_CONFLICT_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_RESOLVE_CONFLICT_ID || "resolve-conflict"

interface ReviewData {
  id: string
  applicationId: string
  moderatorUserId: string
  moderatorDiscordId: string
  moderatorDiscordUsername: string
  rating: number
  ratingZone: string
  moderatorNote: string | null
  reviewedAt: string
}

interface ApplicationData {
  id: string
  minecraftIGN: string
  skinUrl: string
  discordUsername: string
  discordId: string
  joinedAt: string | null
  timezone: string
  createdAt: string
  status: string
  answers: { question: string; answer: string }[]
}

interface ConflictDetailResult {
  application: ApplicationData | null
  reviews: ReviewData[]
}

interface ResolveResult {
  success: boolean
  error?: string
}

function getColor(zone: string | number): string {
  if (typeof zone === "string") {
    if (zone === "red") return "#ef4444"
    if (zone === "orange") return "#f97316"
    if (zone === "yellow") return "#eab308"
    return "#22c55e"
  }
  if (zone <= 25) return "#ef4444"
  if (zone <= 50) return "#f97316"
  if (zone <= 75) return "#eab308"
  return "#22c55e"
}

function getSliderBackground(): string {
  return "linear-gradient(to right, #ef4444 0%, #ef4444 25%, #f97316 25%, #f97316 50%, #eab308 50%, #eab308 75%, #22c55e 75%, #22c55e 100%)"
}

export function ModeratorConflictDetailPage() {
  const { allowed, loading: accessLoading } = useModeratorAccess()
  const navigate = useNavigate()
  const { applicationId } = useParams<{ applicationId: string }>()

  const [application, setApplication] = useState<ApplicationData | null>(null)
  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [customRating, setCustomRating] = useState<number>(50)
  const [customNote, setCustomNote] = useState<string>("")

  useEffect(() => {
    if (!applicationId) return
    if (!allowed) return
    let cancelled = false
    callFunction<ConflictDetailResult>(CONFLICT_DETAIL_FUNCTION_ID, { applicationId })
      .then((result) => {
        if (cancelled) return
        setApplication(result.application)
        setReviews(result.reviews)
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : "Failed to load conflict detail.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [allowed, applicationId])

  const handleResolve = async (chosenReviewId: string) => {
    if (!applicationId) return
    setSaving(true)
    setSaveError(null)
    try {
      const result = await callFunction<ResolveResult>(
        RESOLVE_CONFLICT_FUNCTION_ID,
        {
          applicationId,
          chosenReviewId,
          chosenRating: customRating,
          moderatorNote: customNote || undefined,
        }
      )
      if (result.success) {
        navigate("/moderator/conflicts")
      } else {
        setSaveError(result.error || "Failed to resolve conflict.")
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to resolve.")
    } finally {
      setSaving(false)
    }
  }

  if (accessLoading || !allowed) return null

  if (loading) {
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
        <Skeleton className="h-48 w-full" />
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
              <p className="text-lg text-white/60">Application not found.</p>
            )}
            <Button variant="outline" onClick={() => navigate("/moderator/conflicts")}>
              Back to Conflicts
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const spread = reviews.length >= 2
    ? Math.max(...reviews.map((r) => r.rating)) - Math.min(...reviews.map((r) => r.rating))
    : 0

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/moderator/conflicts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Conflict Detail</h1>
        <Gavel className="h-5 w-5 text-yellow-400" />
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

        <div className="space-y-4 md:sticky md:top-12 md:self-start">
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
                  <span className="font-medium text-white">{application.minecraftIGN}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Discord</span>
                  <span className="font-medium text-white">{application.discordUsername}</span>
                </div>
                {application.joinedAt && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Server Joined</span>
                    <span className="font-medium text-white">
                      {new Date(application.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/50">Timezone</span>
                  <span className="font-medium text-white">{application.timezone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Applied</span>
                  <span className="font-medium text-white">
                    {new Date(application.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Status</span>
                  <span className="font-medium text-white capitalize">{application.status}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Moderator Reviews</h2>
            <span className="text-sm text-white/40">Spread: {spread}%</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-lg border border-white/10 bg-white/5 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    {review.moderatorDiscordUsername}
                  </span>
                  <span className="text-2xl font-bold" style={{ color: getColor(review.rating) }}>
                    {review.rating}%
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span
                    className="inline-block rounded px-1.5 py-0.5 font-medium"
                    style={{
                      backgroundColor: getColor(review.rating) + "20",
                      color: getColor(review.rating),
                    }}
                  >
                    {review.ratingZone}
                  </span>
                  <span>{new Date(review.reviewedAt).toLocaleString()}</span>
                </div>

                {review.moderatorNote && (
                  <p className="text-sm text-white/60 whitespace-pre-wrap">{review.moderatorNote}</p>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => {
                    setCustomRating(review.rating)
                    setCustomNote(review.moderatorNote || "")
                  }}
                >
                  Use this rating
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Your Decision</h2>

          <div className="space-y-2">
            <label className="text-sm text-white/60">Rating</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={customRating}
                onChange={(e) => setCustomRating(Number(e.target.value))}
                className="flex-1"
                style={{
                  background: getSliderBackground(),
                  height: "8px",
                  borderRadius: "4px",
                  appearance: "none",
                  cursor: "pointer",
                }}
              />
              <span
                className="text-xl font-bold min-w-[3ch]"
                style={{ color: getColor(customRating) }}
              >
                {customRating}%
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/60">Description</label>
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              rows={3}
              placeholder="Optional note about this override..."
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
            />
          </div>

          {saveError && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {reviews.map((review) => (
              <Button
                key={review.id}
                size="sm"
                disabled={saving}
                onClick={() => handleResolve(review.id)}
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? "Resolving..." : `Override (${review.moderatorDiscordUsername})`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
