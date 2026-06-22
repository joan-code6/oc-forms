import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction } from "@/lib/functions"
import { ArrowLeft, AlertTriangle, Save, X } from "lucide-react"

const REVIEW_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_REVIEW_ID || "get-mod-review"
const UPDATE_REVIEW_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_UPDATE_REVIEW_ID || "update-mod-review"

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

interface ReviewResult {
  review: ReviewData
  application: ApplicationData | null
}

interface UpdateResult {
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

export function ModeratorAuditDetailPage() {
  const { allowed, loading: accessLoading } = useModeratorAccess()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [review, setReview] = useState<ReviewData | null>(null)
  const [application, setApplication] = useState<ApplicationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editRating, setEditRating] = useState<number>(50)
  const [editNote, setEditNote] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    if (!allowed) return
    let cancelled = false
    callFunction<ReviewResult>(REVIEW_FUNCTION_ID, { reviewId: id })
      .then((result) => {
        if (cancelled) return
        setReview(result.review)
        setApplication(result.application)
        setEditRating(result.review.rating)
        setEditNote(result.review.moderatorNote || "")
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : "Failed to load review.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [allowed, id])

  const startEdit = () => {
    if (!review) return
    setEditRating(review.rating)
    setEditNote(review.moderatorNote || "")
    setSaveError(null)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    if (!review) return
    setEditRating(review.rating)
    setEditNote(review.moderatorNote || "")
    setSaveError(null)
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!review || !id) return
    setSaving(true)
    setSaveError(null)
    try {
      const result = await callFunction<UpdateResult>(UPDATE_REVIEW_FUNCTION_ID, {
        reviewId: id,
        rating: editRating,
        moderatorNote: editNote,
        applicationId: review.applicationId,
      })
      if (result.success) {
        const zone = getRatingZone(editRating)
        setReview((prev) =>
          prev
            ? {
                ...prev,
                rating: editRating,
                ratingZone: zone,
                moderatorNote: editNote || null,
              }
            : prev
        )
        setIsEditing(false)
      } else {
        setSaveError(result.error || "Failed to update review.")
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save review.")
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
      </div>
    )
  }

  if (loadError || !review) {
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
              <p className="text-lg text-white/60">Review not found.</p>
            )}
            <Button variant="outline" onClick={() => navigate("/moderator/audit")}>
              Back to Audit Log
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const zone = isEditing ? getRatingZone(editRating) : review.ratingZone
  const ratingValue = isEditing ? editRating : review.rating

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/moderator/audit")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Audit Review</h1>
      </div>

      {application && (
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
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Review Details</h2>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={startEdit}>
                Edit Review
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-white/50">Reviewer</p>
              <p className="text-sm font-medium text-white">{review.moderatorDiscordUsername}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/50">Reviewed</p>
              <p className="text-sm font-medium text-white">
                {new Date(review.reviewedAt).toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/50">Rating</p>
              <p
                className="text-sm font-bold"
                style={{
                  color:
                    review.ratingZone === "red"
                      ? "#ef4444"
                      : review.ratingZone === "orange"
                        ? "#f97316"
                        : review.ratingZone === "yellow"
                          ? "#eab308"
                          : "#22c55e",
                }}
              >
                {review.rating}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/50">Application ID</p>
              <p className="text-sm font-medium text-white font-mono">{review.applicationId}</p>
            </div>
          </div>

          {review.moderatorNote && !isEditing && (
            <div className="space-y-1">
              <p className="text-xs text-white/50">Moderator Note</p>
              <p className="whitespace-pre-wrap text-sm text-white/80">{review.moderatorNote}</p>
            </div>
          )}

          {isEditing && (
            <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60">Rating</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={editRating}
                    onChange={(e) => setEditRating(Number(e.target.value))}
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
                    style={{
                      color:
                        zone === "red"
                          ? "#ef4444"
                          : zone === "orange"
                            ? "#f97316"
                            : zone === "yellow"
                              ? "#eab308"
                              : "#22c55e",
                    }}
                  >
                    {ratingValue}%
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/60">Moderator Note</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={3}
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
                <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
