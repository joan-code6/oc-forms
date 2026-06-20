import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction } from "@/lib/functions"
import { ArrowLeft, AlertTriangle, Gavel } from "lucide-react"

const CONFLICTS_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_CONFLICTS_ID || "get-review-conflicts"
const RESOLVE_CONFLICT_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_RESOLVE_CONFLICT_ID || "resolve-conflict"

interface ReviewEntry {
  id: string
  rating: number
  ratingZone: string
  moderatorUserId: string
  moderatorDiscordUsername: string
  moderatorDiscordId: string
  moderatorNote: string | null
  reviewedAt: string
}

interface ConflictGroup {
  applicationId: string
  reviews: ReviewEntry[]
  minRating: number
  maxRating: number
  ratingSpread: number
}

interface ConflictsResult {
  conflicts: ConflictGroup[]
  total: number
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

export function ModeratorConflictsPage() {
  const { allowed, loading: accessLoading } = useModeratorAccess()
  const navigate = useNavigate()

  const [conflicts, setConflicts] = useState<ConflictGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [resolvingApp, setResolvingApp] = useState<string | null>(null)
  const [chosenReview, setChosenReview] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    callFunction<ConflictsResult>(CONFLICTS_FUNCTION_ID)
      .then((result) => {
        if (!cancelled) {
          setConflicts(result.conflicts)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load conflicts.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [allowed])

  const handleResolve = async (appId: string, chosenReviewId: string) => {
    setSaving(true)
    setSaveError(null)
    try {
      const existingReview = conflicts
        .find((c) => c.applicationId === appId)
        ?.reviews.find((r) => r.id === chosenReviewId)

      if (!existingReview) return

      const result = await callFunction<ResolveResult>(
        RESOLVE_CONFLICT_FUNCTION_ID,
        { applicationId: appId, chosenReviewId, chosenRating: existingReview.rating }
      )

      if (result.success) {
        setConflicts((prev) => prev.filter((c) => c.applicationId !== appId))
        setResolvingApp(null)
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/moderator")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Conflicts</h1>
        <Gavel className="h-5 w-5 text-yellow-400" />
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : conflicts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/40">No rating conflicts found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {conflicts.map((conflict) => (
            <Card key={conflict.applicationId}>
              <CardContent className="p-5">
                <p className="text-sm text-white/50 mb-3">Application {conflict.applicationId}</p>
                <div className="grid grid-cols-2 gap-4">
                  {conflict.reviews.map((review) => (
                    <button
                      key={review.id}
                      onClick={() => {
                        setResolvingApp(conflict.applicationId)
                        setChosenReview(review.id)
                      }}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        resolvingApp === conflict.applicationId && chosenReview === review.id
                          ? "border-brand bg-brand/10"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{review.moderatorDiscordUsername}</span>
                        <span className="text-lg font-bold" style={{ color: getColor(review.rating) }}>
                          {review.rating}%
                        </span>
                      </div>
                      {review.moderatorNote && (
                        <p className="text-xs text-white/50 line-clamp-2">{review.moderatorNote}</p>
                      )}
                      <p className="text-xs text-white/30 mt-1">
                        {new Date(review.reviewedAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span style={{ color: getColor(conflict.minRating) }}>Low: {conflict.minRating}%</span>
                    <span className="text-white/20">|</span>
                    <span style={{ color: getColor(conflict.maxRating) }}>High: {conflict.maxRating}%</span>
                    <span className="text-white/50">(spread: {conflict.ratingSpread}%)</span>
                  </div>

                  {resolvingApp === conflict.applicationId && chosenReview && (
                    <div className="flex items-center gap-2">
                      {saveError && (
                        <span className="text-xs text-red-400">{saveError}</span>
                      )}
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() => handleResolve(conflict.applicationId, chosenReview)}
                      >
                        {saving ? "Resolving..." : "Override with this rating"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
