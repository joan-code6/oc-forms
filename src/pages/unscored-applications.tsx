import { useState, useEffect, useMemo, useCallback } from "react"
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
import { ArrowLeft, AlertTriangle, Search, Eye, ArrowUpDown, ArrowUp, ArrowDown, Clock, MapPin, Loader2 } from "lucide-react"

const PAGE_SIZE = 50

const UNSCORED_APPLICATIONS_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_UNSCORED_APPS_ID || "get-unscored-applications"

interface UnscoredApplication {
  id: string
  minecraftIGN: string
  discordUsername: string
  joinedAt: string | null
  timezone: string
  createdAt: string
  status: string
  skinUrl: string
  discordRoles?: string[]
  discordRolesUnavailable?: boolean
  reviewerCount?: number
  reviewers?: { username: string; discordUsername: string }[]
}

interface UnscoredAppsResult {
  applications: UnscoredApplication[]
  total: number
  hasMore: boolean
}

export function UnscoredApplicationsPage() {
  const { allowed, loading: accessLoading } = useModeratorAccess()
  const navigate = useNavigate()

  const [applications, setApplications] = useState<UnscoredApplication[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [timezoneFilter, setTimezoneFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"date" | "ign">("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const fetchPage = useCallback(async (offset: number, append = false) => {
    const result = await callFunction<UnscoredAppsResult>(UNSCORED_APPLICATIONS_FUNCTION_ID, {
      offset,
      limit: PAGE_SIZE,
    })
    if (append) {
      setApplications((prev) => [...prev, ...result.applications])
    } else {
      setApplications(result.applications)
    }
    setTotal(result.total)
    setHasMore(result.hasMore)
  }, [])

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    setLoading(true)
    fetchPage(0, false)
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load applications.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [allowed, fetchPage])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      await fetchPage(applications.length, true)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load more.")
    } finally {
      setLoadingMore(false)
    }
  }

  const timezones = useMemo(() => {
    const zones = new Set(applications.map((app) => app.timezone).filter(Boolean))
    return ["all", ...Array.from(zones).sort()]
  }, [applications])

  const statuses = useMemo(() => {
    const set = new Set(applications.map((app) => app.status).filter(Boolean))
    return ["all", ...Array.from(set).sort()]
  }, [applications])

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase()
    return applications.filter((app) => {
      const matchesSearch =
        !query ||
        app.minecraftIGN.toLowerCase().includes(query) ||
        app.discordUsername.toLowerCase().includes(query) ||
        app.id.toLowerCase().includes(query)
      const matchesStatus =
        statusFilter === "all" || app.status === statusFilter
      const matchesTimezone =
        timezoneFilter === "all" || app.timezone === timezoneFilter
      return matchesSearch && matchesStatus && matchesTimezone
    }).sort((a, b) => {
      if (sortBy === "date") {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return sortDir === "asc" ? dateA - dateB : dateB - dateA
      }
      return sortDir === "asc"
        ? a.minecraftIGN.localeCompare(b.minecraftIGN)
        : b.minecraftIGN.localeCompare(a.minecraftIGN)
    })
  }, [applications, search, statusFilter, timezoneFilter, sortBy, sortDir])

  const toggleSort = (field: "date" | "ign") => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortDir("desc")
    }
  }

  const renderSortIcon = (field: "date" | "ign") => {
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
        <h1 className="text-2xl font-bold text-white">Unscored Applications</h1>
        <Clock className="h-5 w-5 text-yellow-400" />
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
            placeholder="Search by applicant or app ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
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
        <Select value={timezoneFilter} onValueChange={setTimezoneFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All timezones</SelectItem>
            {timezones
              .filter((z) => z !== "all")
              .map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
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
            onClick={() => toggleSort("ign")}
            className="gap-1.5"
          >
            {renderSortIcon("ign")}
            IGN
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/40">No unscored applications found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <Card key={app.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  <div className="flex flex-1 items-start gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/5">
                      <img
                        src={app.skinUrl}
                        alt={`${app.minecraftIGN} skin`}
                        className="h-10 w-auto rounded"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-white">
                          {app.minecraftIGN || "Unknown applicant"}
                        </span>
                        <span className="text-sm text-white/40">
                          {app.discordUsername || "No discord"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-white/50">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                        {app.joinedAt && (
                          <span className="text-white/50">
                            Joined {new Date(app.joinedAt).toLocaleDateString()}
                          </span>
                        )}
                        {app.timezone && (
                          <span className="flex items-center gap-1 text-white/50">
                            <MapPin className="h-3 w-3" />
                            {app.timezone}
                          </span>
                        )}
                        {app.status && (
                          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70 capitalize">
                            {app.status.replace(/_/g, " ")}
                          </span>
                        )}
                        {app.reviewerCount !== undefined && app.reviewerCount > 0 && (
                          <span className="text-white/40 text-xs">
                            {app.reviewerCount} prior review{app.reviewerCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end border-t border-white/5 p-3 sm:border-t-0 sm:border-l sm:p-5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/moderator/review`, { state: { applicationId: app.id } })}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Review
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {hasMore && applications.length >= PAGE_SIZE && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {loadingMore ? "Loading..." : `Load more (${applications.length} of ${total} loaded)`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
