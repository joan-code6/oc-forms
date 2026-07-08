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
import {
  ArrowLeft,
  ShieldCheck,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  UserPlus,
  AlertTriangle,
  Loader2,
  Send,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

const APPLICATIONS_FUNCTION_ID = "get-all-applications"
const ROLES_FUNCTION_ID = "manage-manual-roles"

interface ReviewInfo {
  moderatorUsername: string
  rating: number
  ratingZone: string
  note: string | null
  reviewedAt: string
}

interface ApplicationData {
  id: string
  userId: string
  minecraftIGN: string
  skinUrl: string
  discordUsername: string
  discordId: string
  timezone: string
  createdAt: string
  status: string
  rating: number
  ratingZone: string
  isAccepted: boolean
  reviews: ReviewInfo[]
}

interface ApplicationsResult {
  applications: ApplicationData[]
  total: number
}

interface AcceptResult {
  success: boolean
  alreadyAccepted?: boolean
  roleApplied?: boolean
  roleError?: string | null
  dmSent?: boolean
  dmError?: string | null
  user?: { username?: string; minecraftIGN?: string }
}

interface EmbedStatus {
  success: boolean
  exists: boolean
  channelId: string | null
  messageIds: string[]
}

function ratingColor(zone: string): string {
  switch (zone) {
    case "green": return "#22c55e"
    case "yellow": return "#eab308"
    case "orange": return "#f97316"
    case "red": return "#ef4444"
    default: return "oklch(0.55 0.01 260)"
  }
}

export function ModeratorApplicationsPage() {
  const { allowed, loading: accessLoading, isAdmin } = useModeratorAccess()
  const navigate = useNavigate()

  const [applications, setApplications] = useState<ApplicationData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [zoneFilter, setZoneFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"date" | "rating" | "ign">("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const [accepting, setAccepting] = useState<string | null>(null)

  const [embedStatus, setEmbedStatus] = useState<EmbedStatus | null>(null)
  const [embedChannelId, setEmbedChannelId] = useState("")
  const [creatingEmbed, setCreatingEmbed] = useState(false)
  const [deletingEmbed, setDeletingEmbed] = useState(false)

  useEffect(() => {
    if (!allowed || !isAdmin) return
    let cancelled = false
    callFunction<ApplicationsResult>(APPLICATIONS_FUNCTION_ID)
      .then((result) => {
        if (!cancelled) setApplications(result.applications)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load applications.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [allowed, isAdmin])

  useEffect(() => {
    if (!allowed || !isAdmin) return
    callFunction<EmbedStatus>(ROLES_FUNCTION_ID, { action: "get-embed-status" })
      .then((result) => setEmbedStatus(result))
      .catch(() => {})
  }, [allowed, isAdmin])

  const statuses = useMemo(() => {
    const set = new Set(applications.map((a) => a.status).filter(Boolean))
    return ["all", ...Array.from(set).sort()]
  }, [applications])

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase()
    return applications
      .filter((app) => {
        const matchesSearch =
          !query ||
          app.minecraftIGN.toLowerCase().includes(query) ||
          app.discordUsername.toLowerCase().includes(query) ||
          app.id.toLowerCase().includes(query)
        const matchesStatus = statusFilter === "all" || app.status === statusFilter
        const matchesZone = zoneFilter === "all" || app.ratingZone === zoneFilter
        return matchesSearch && matchesStatus && matchesZone
      })
      .sort((a, b) => {
        if (sortBy === "rating") {
          return sortDir === "asc" ? a.rating - b.rating : b.rating - a.rating
        }
        if (sortBy === "ign") {
          return sortDir === "asc"
            ? a.minecraftIGN.localeCompare(b.minecraftIGN)
            : b.minecraftIGN.localeCompare(a.minecraftIGN)
        }
        return sortDir === "asc"
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [applications, search, statusFilter, zoneFilter, sortBy, sortDir])

  const acceptedCount = useMemo(
    () => applications.filter((a) => a.isAccepted).length,
    [applications],
  )

  const toggleSort = (field: "date" | "rating" | "ign") => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortDir("desc")
    }
  }

  const renderSortIcon = (field: "date" | "rating" | "ign") => {
    if (sortBy !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-white/30" />
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 text-brand" />
      : <ArrowDown className="h-3.5 w-3.5 text-brand" />
  }

  const handleAccept = async (app: ApplicationData) => {
    setAccepting(app.id)
    try {
      const result = await callFunction<AcceptResult>(ROLES_FUNCTION_ID, {
        action: "accept",
        targetUserId: app.userId,
      })
      if (result.success) {
        if (result.alreadyAccepted) {
          const roleMsg = result.roleApplied ? " — Role applied" : result.roleError ? ` — Role: ${result.roleError}` : ""
          toast.info(`User was already accepted.${roleMsg}`)
        } else {
          const roleMsg = result.roleApplied ? " — Role applied" : result.roleError ? ` — Role: ${result.roleError}` : " — No Discord ID"
          toast.success(
            `Accepted ${result.user?.username || result.user?.minecraftIGN || "user"}${roleMsg}${result.dmSent ? " — DM sent" : ""}`,
          )
          if (result.roleError) {
            toast.error(`Role: ${result.roleError}`)
          }
          if (!result.dmSent && result.dmError) {
            toast.error(`DM: ${result.dmError}`)
          }
        }
        setApplications((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, isAccepted: true } : a)),
        )
        fetchEmbedStatus()
      } else {
        toast.error("Failed to accept user.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Accept failed.")
    } finally {
      setAccepting(null)
    }
  }

  const fetchEmbedStatus = async () => {
    try {
      const result = await callFunction<EmbedStatus>(ROLES_FUNCTION_ID, { action: "get-embed-status" })
      setEmbedStatus(result)
    } catch {
      // ignore
    }
  }

  const handleCreateEmbed = async () => {
    if (!embedChannelId.trim()) return
    setCreatingEmbed(true)
    try {
      const result = await callFunction<{ success: boolean; channelId?: string; messageId?: string; error?: string }>(
        ROLES_FUNCTION_ID,
        { action: "create-embed", channelId: embedChannelId.trim() },
      )
      if (result.success) {
        toast.success(`Embed created in <#${result.channelId}>`)
        fetchEmbedStatus()
      } else {
        toast.error(result.error || "Failed to create embed.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create embed failed.")
    } finally {
      setCreatingEmbed(false)
    }
  }

  const handleDeleteEmbed = async () => {
    if (!confirm("Delete the Discord embed? The accepted list will no longer auto-update.")) return
    setDeletingEmbed(true)
    try {
      const result = await callFunction<{ success: boolean; error?: string }>(ROLES_FUNCTION_ID, {
        action: "delete-embed",
      })
      if (result.success) {
        toast.success("Embed deleted.")
        fetchEmbedStatus()
      } else {
        toast.error(result.error || "Failed to delete embed.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete embed failed.")
    } finally {
      setDeletingEmbed(false)
    }
  }

  if (accessLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-12">
        <Card>
          <CardContent className="p-6">
            <div className="h-8 w-64 animate-pulse rounded bg-white/5" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!allowed || !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="text-2xl font-bold text-white">Admin Only</h1>
        <p className="text-white/40">You need administrator permissions to access this page.</p>
        <Button variant="outline" onClick={() => navigate("/moderator")}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/moderator")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Applications</h1>
        <span className="text-sm text-white/40">
          {acceptedCount}/{applications.length} accepted
        </span>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {/* Accepted List Section */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">Accepted Player List</p>
              {embedStatus === null ? (
                <span className="text-xs text-white/30">—</span>
              ) : embedStatus.exists ? (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Active in #{embedStatus.channelId} ({embedStatus.messageIds.length} messages)
                </span>
              ) : (
                <span className="text-xs text-white/30">Not configured</span>
              )}
            </div>
            {embedStatus?.exists && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteEmbed}
                disabled={deletingEmbed}
              >
                {deletingEmbed ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete List
              </Button>
            )}
          </div>
          {embedStatus && !embedStatus.exists && (
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Discord channel ID..."
                value={embedChannelId}
                onChange={(e) => setEmbedChannelId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateEmbed()}
              />
              <Button
                variant="default"
                size="sm"
                onClick={handleCreateEmbed}
                disabled={creatingEmbed || !embedChannelId.trim()}
              >
                {creatingEmbed ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Create List
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search by IGN, Discord name, or app ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
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
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Rating zone" />
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
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => toggleSort("date")} className="gap-1.5">
            {renderSortIcon("date")} Date
          </Button>
          <Button variant="outline" size="sm" onClick={() => toggleSort("rating")} className="gap-1.5">
            {renderSortIcon("rating")} Rating
          </Button>
          <Button variant="outline" size="sm" onClick={() => toggleSort("ign")} className="gap-1.5">
            {renderSortIcon("ign")} IGN
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/40">No applications found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                <th className="px-3 py-2.5">Player</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Rating</th>
                <th className="px-3 py-2.5 hidden md:table-cell">Moderator Reviews</th>
                <th className="px-3 py-2.5 w-28 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredApplications.map((app) => (
                <tr
                  key={app.id}
                  className={`transition-colors ${app.isAccepted ? "bg-green-500/[0.04]" : "hover:bg-white/[0.02]"}`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={app.skinUrl}
                        alt=""
                        className="h-8 w-auto rounded"
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <button
                          className="text-sm text-white hover:text-brand transition-colors text-left truncate block max-w-36"
                          onClick={() =>
                            navigate("/moderator/review", { state: { applicationId: app.id } })
                          }
                          title="Open in review"
                        >
                          {app.minecraftIGN || "N/A"}
                        </button>
                        <span className="text-xs text-white/40 truncate block max-w-36">
                          {app.discordUsername || "—"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/70 capitalize whitespace-nowrap">
                      {app.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="font-medium text-sm"
                      style={{ color: ratingColor(app.ratingZone) }}
                    >
                      {app.rating}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      {app.reviews.length === 0 ? (
                        <span className="text-xs text-white/20">No reviews</span>
                      ) : (
                        app.reviews.map((r, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-xs"
                          >
                            <span className="text-white/60">{r.moderatorUsername}</span>
                            <span style={{ color: ratingColor(r.ratingZone) }}>
                              {r.rating}%
                            </span>
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {app.isAccepted ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Accepted
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAccept(app)}
                        disabled={accepting === app.id}
                      >
                        {accepting === app.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        Accept
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filteredApplications.length > 0 && (
        <p className="text-xs text-white/20 text-center">
          Showing {filteredApplications.length} of {applications.length} applications
        </p>
      )}
    </div>
  )
}
