import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction } from "@/lib/functions"
import { ArrowLeft, AlertTriangle, ShieldCheck, Search, Pencil, User, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react"

const REVIEWS_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_REVIEWS_ID || "get-mod-reviews"

interface ApplicationSummary {
  id: string
  minecraftIGN: string
  discordUsername: string
  skinUrl: string
  status: string
}

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
  application: ApplicationSummary | null
}

interface ReviewsResult {
  reviews: ReviewData[]
  total: number
}

export function ModeratorAuditPage() {
  const { allowed, loading: accessLoading } = useModeratorAccess()
  const navigate = useNavigate()

  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [reviewerFilter, setReviewerFilter] = useState("all")
  const [zoneFilter, setZoneFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"date" | "rating">("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    callFunction<ReviewsResult>(REVIEWS_FUNCTION_ID)
      .then((result) => {
        if (!cancelled) setReviews(result.reviews)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load reviews.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [allowed])

  const reviewers = useMemo(() => {
    const names = new Set(reviews.map((r) => r.moderatorDiscordUsername).filter(Boolean))
    return ["all", ...Array.from(names).sort()]
  }, [reviews])

  const statuses = useMemo(() => {
    const set = new Set(reviews.map((r) => r.application?.status).filter(Boolean) as string[])
    return ["all", ...Array.from(set).sort()]
  }, [reviews])

  const filteredReviews = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = reviews.filter((review) => {
      const app = review.application
      const matchesSearch =
        !query ||
        app?.minecraftIGN.toLowerCase().includes(query) ||
        app?.discordUsername.toLowerCase().includes(query) ||
        review.moderatorDiscordUsername.toLowerCase().includes(query) ||
        review.applicationId.toLowerCase().includes(query)
      const matchesReviewer =
        reviewerFilter === "all" || review.moderatorDiscordUsername === reviewerFilter
      const matchesZone =
        zoneFilter === "all" || review.ratingZone === zoneFilter
      const matchesStatus =
        statusFilter === "all" || review.application?.status === statusFilter
      return matchesSearch && matchesReviewer && matchesZone && matchesStatus
    })

    filtered.sort((a, b) => {
      if (sortBy === "rating") {
        return sortDir === "asc" ? a.rating - b.rating : b.rating - a.rating
      }
      const dateA = new Date(a.reviewedAt).getTime()
      const dateB = new Date(b.reviewedAt).getTime()
      return sortDir === "asc" ? dateA - dateB : dateB - dateA
    })

    return filtered
  }, [reviews, search, reviewerFilter, zoneFilter, statusFilter, sortBy, sortDir])

  const toggleSort = (field: "date" | "rating") => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortDir("desc")
    }
  }

  const renderSortIcon = (field: "date" | "rating") => {
    if (sortBy !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-white/30" />
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 text-brand" />
      : <ArrowDown className="h-3.5 w-3.5 text-brand" />
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search by applicant, reviewer, or app ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={reviewerFilter} onValueChange={setReviewerFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Filter by reviewer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reviewers</SelectItem>
            {reviewers
              .filter((name) => name !== "all")
              .map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by zone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All zones</SelectItem>
            <SelectItem value="green">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                Green (76-100%)
              </span>
            </SelectItem>
            <SelectItem value="yellow">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" />
                Yellow (51-75%)
              </span>
            </SelectItem>
            <SelectItem value="orange">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
                Orange (26-50%)
              </span>
            </SelectItem>
            <SelectItem value="red">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                Red (0-25%)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses
              .filter((s) => s !== "all")
              .map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="capitalize">{s.replace(/_/g, " ")}</span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleSort("date")}
            className="gap-1.5"
          >
            {renderSortIcon("date")}
            Date
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleSort("rating")}
            className="gap-1.5"
          >
            {renderSortIcon("rating")}
            Rating
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/40">No reviews found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <Card key={review.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  <div className="flex flex-1 items-start gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/5">
                      {review.application ? (
                        <img
                          src={review.application.skinUrl}
                          alt={`${review.application.minecraftIGN} skin`}
                          className="h-10 w-auto rounded"
                        />
                      ) : (
                        <User className="h-6 w-6 text-white/30" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          className="text-sm font-medium text-white hover:text-brand transition-colors flex items-center gap-1"
                          onClick={() =>
                            navigate("/moderator/review", {
                              state: { applicationId: review.applicationId },
                            })
                          }
                          title="Open in review"
                        >
                          {review.application?.minecraftIGN || "Unknown applicant"}
                          <ExternalLink className="h-3 w-3 text-white/40" />
                        </button>
                        <span className="text-sm text-white/40">
                          {review.application?.discordUsername || "No discord"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-white/50">
                          {new Date(review.reviewedAt).toLocaleDateString()}
                        </span>
                        <span
                          className="font-medium"
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
                        </span>
                        <span className="text-white/60">
                          by {review.moderatorDiscordUsername}
                        </span>
                        {review.application?.status && (
                          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70 capitalize">
                            {review.application.status}
                          </span>
                        )}
                      </div>
                      {review.moderatorNote && (
                        <p className="line-clamp-2 text-sm text-white/70">
                          {review.moderatorNote}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end border-t border-white/5 p-3 sm:border-t-0 sm:border-l sm:p-5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/moderator/audit/${review.id}`)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
