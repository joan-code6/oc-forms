import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction } from "@/lib/functions"
import { ArrowLeft, AlertTriangle, ShieldCheck } from "lucide-react"

const REVIEWS_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_REVIEWS_ID || "get-mod-reviews"
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

interface ReviewsResult {
  reviews: ReviewData[]
  total: number
}

function getRatingZone(value: number): "red" | "orange" | "yellow" | "green" {
  if (value <= 25) return "red"
  if (value <= 50) return "orange"
  if (value <= 75) return "yellow"
  return "green"
}

export function ModeratorAuditPage() {
  const { allowed, loading: accessLoading } = useModeratorAccess()
  const navigate = useNavigate()

  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRating, setEditRating] = useState<number>(50)
  const [editNote, setEditNote] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await callFunction<ReviewsResult>(REVIEWS_FUNCTION_ID)
      setReviews(result.reviews)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load reviews.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    loadReviews()
  }, [allowed])

  const startEdit = (review: ReviewData) => {
    setEditingId(review.id)
    setEditRating(review.rating)
    setEditNote(review.moderatorNote || "")
    setSaveError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setSaveError(null)
  }

  const handleSave = async () => {
    if (!editingId) return
    setSaving(true)
    setSaveError(null)
    try {
      const review = reviews.find((r) => r.id === editingId)
      if (!review) return
      const result = await callFunction<{ success: boolean; error?: string }>(
        UPDATE_REVIEW_FUNCTION_ID,
        { reviewId: editingId, rating: editRating, moderatorNote: editNote, applicationId: review.applicationId }
      )
      if (result.success) {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === editingId
              ? { ...r, rating: editRating, ratingZone: getRatingZone(editRating), moderatorNote: editNote || null }
              : r
          )
        )
        setEditingId(null)
      } else {
        setSaveError(result.error || "Failed to update.")
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  if (accessLoading || !allowed) return null

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/moderator")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <ShieldCheck className="h-5 w-5 text-brand" />
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/40">No reviews found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-5">
                {editingId === review.id ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-white/50 mb-1 block">Rating</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={editRating}
                            onChange={(e) => setEditRating(Number(e.target.value))}
                            className="flex-1"
                            style={{
                              background: "linear-gradient(to right, #ef4444 0%, #ef4444 25%, #f97316 25%, #f97316 50%, #eab308 50%, #eab308 75%, #22c55e 75%, #22c55e 100%)",
                              height: "8px",
                              borderRadius: "4px",
                              appearance: "none",
                              cursor: "pointer",
                            }}
                          />
                          <span
                            className="text-xl font-bold min-w-[3ch]"
                            style={{
                              color: getRatingZone(editRating) === "red" ? "#ef4444"
                                : getRatingZone(editRating) === "orange" ? "#f97316"
                                : getRatingZone(editRating) === "yellow" ? "#eab308"
                                : "#22c55e",
                            }}
                          >
                            {editRating}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1 block">Note</label>
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
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white/50">
                          {new Date(review.reviewedAt).toLocaleDateString()}
                        </span>
                        <span
                          className="text-sm font-medium px-2 py-0.5 rounded"
                          style={{
                            color:
                              review.ratingZone === "red" ? "#ef4444"
                              : review.ratingZone === "orange" ? "#f97316"
                              : review.ratingZone === "yellow" ? "#eab308"
                              : "#22c55e",
                          }}
                        >
                          {review.rating}%
                        </span>
                        <span className="text-sm text-white/60">
                          by {review.moderatorDiscordUsername}
                        </span>
                      </div>
                      {review.moderatorNote && (
                        <p className="text-sm text-white/70">{review.moderatorNote}</p>
                      )}
                      <p className="text-xs text-white/30 font-mono">
                        App: {review.applicationId}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(review)}
                    >
                      Edit
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
