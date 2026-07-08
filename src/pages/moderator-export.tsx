import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction, callFunctionAsync, pollAndParseExecution } from "@/lib/functions"
import { toast } from "sonner"
import {
  ArrowLeft,
  Download,
  Play,
  ShieldCheck,
  UserPlus,
  UserMinus,
  Trash2,
  AlertTriangle,
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react"

const EXPORT_FUNCTION_ID = "export-accept-applications"
const GET_ACCEPTED_FUNCTION_ID = "get-accepted-users"
const MANAGE_LABEL_FUNCTION_ID = "manage-accepted-label"
const DISCORD_ROLE_FUNCTION_ID = "manage-discord-event-role"
const MANUAL_ROLES_FUNCTION_ID = "manage-manual-roles"
const WHITELIST_FUNCTION_ID = "export-whitelist"

interface AcceptedUser {
  id: string
  userId: string
  discordUsername: string
  discordId: string
  minecraftIGN: string
  rating: number
  assignedAt: string
  assignedBy: string
}

interface ExportResult {
  success: boolean
  accepted: number
  skipped: number
  rolesAssigned?: number
  rolesFailed?: number
  users: AcceptedUser[]
}

interface AcceptedUsersResult {
  success: boolean
  users: AcceptedUser[]
  total: number
}

interface SearchResult {
  userId: string
  discordUsername: string
  minecraftIGN: string
  rating: number
  status: string
}

interface DiscordRoleResult {
  success: boolean
  action: string
  assigned?: number
  failed: number
  details: { userId: string; discordUsername: string; status?: string; error?: string }[]
}

interface WhitelistResult {
  success: boolean
  names: string[]
  total: number
}

export function ModeratorExportPage() {
  const { allowed, loading: accessLoading, isAdmin } = useModeratorAccess()
  const navigate = useNavigate()

  const [maxPlayers, setMaxPlayers] = useState("10")
  const [minPercentage, setMinPercentage] = useState("0")

  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const [acceptedUsers, setAcceptedUsers] = useState<AcceptedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [removing, setRemoving] = useState<string | null>(null)
  const [removingAll, setRemovingAll] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  const [discordAction, setDiscordAction] = useState<"assign" | "remove" | null>(null)
  const [discordPolling, setDiscordPolling] = useState(false)
  const [discordResult, setDiscordResult] = useState<DiscordRoleResult | null>(null)
  const [discordError, setDiscordError] = useState<string | null>(null)

  const [downloading, setDownloading] = useState(false)

  const [refreshingList, setRefreshingList] = useState(false)

  const handleRefreshList = async () => {
    setRefreshingList(true)
    try {
      const result = await callFunction<{ success: boolean; userCount: number }>(MANUAL_ROLES_FUNCTION_ID, { action: "refresh-list" })
      toast.success(`List refreshed with ${result.userCount} users.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed.")
    } finally {
      setRefreshingList(false)
    }
  }

  const fetchAcceptedUsers = useCallback(async () => {
    setLoadingUsers(true)
    setLoadError(null)
    try {
      const result = await callFunction<AcceptedUsersResult>(GET_ACCEPTED_FUNCTION_ID)
      setAcceptedUsers(result.users)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load users.")
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  const handleExport = async () => {
    const max = parseInt(maxPlayers, 10)
    const min = parseInt(minPercentage, 10)

    if (isNaN(max) || max < 1) {
      toast.error("Max players must be a positive number.")
      return
    }
    if (isNaN(min) || min < 0 || min > 100) {
      toast.error("Min percentage must be between 0 and 100.")
      return
    }

    setExporting(true)
    setExportError(null)
    setExportResult(null)

    try {
      const result = await callFunction<ExportResult>(EXPORT_FUNCTION_ID, {
        maxPlayers: max,
        minPercentage: min,
      })
      setExportResult(result)
      if (result.accepted > 0) {
        const roleInfo = result.rolesAssigned !== undefined
          ? `, ${result.rolesAssigned} roles assigned${result.rolesFailed ? ` (${result.rolesFailed} failed)` : ""}`
          : ""
        toast.success(`${result.accepted} users accepted${result.skipped > 0 ? ` (${result.skipped} skipped)` : ""}${roleInfo}`)
      } else {
        toast.info("No new users to accept.")
      }
      fetchAcceptedUsers()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed."
      setExportError(msg)
      toast.error(msg)
    } finally {
      setExporting(false)
    }
  }

  const handleRemoveUser = async (userId: string) => {
    setRemoving(userId)
    try {
      await callFunction(MANAGE_LABEL_FUNCTION_ID, { action: "remove", targetUserId: userId })
      toast.success("Label removed.")
      setAcceptedUsers((prev) => prev.filter((u) => u.userId !== userId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove label.")
    } finally {
      setRemoving(null)
    }
  }

  const handleRemoveAll = async () => {
    if (!confirm(`Remove the label from all ${acceptedUsers.length} users?`)) return
    setRemovingAll(true)
    try {
      const result = await callFunction<{ success: boolean; removed: number }>(MANAGE_LABEL_FUNCTION_ID, { action: "removeAll" })
      toast.success(`${result.removed} labels removed.`)
      setAcceptedUsers([])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove all labels.")
    } finally {
      setRemovingAll(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults(null)
    try {
      const result = await callFunction<{ success: boolean; results: SearchResult[] }>(MANAGE_LABEL_FUNCTION_ID, {
        action: "search",
        search: searchQuery.trim(),
      })
      setSearchResults(result.results)
      if (result.results.length === 0) {
        toast.info("No matching users found.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed.")
    } finally {
      setSearching(false)
    }
  }

  const handleAddUser = async (userId: string) => {
    setAdding(userId)
    try {
      await callFunction(MANAGE_LABEL_FUNCTION_ID, { action: "add", targetUserId: userId })
      toast.success("Label added.")
      setSearchResults((prev) => prev?.filter((r) => r.userId !== userId) || null)
      fetchAcceptedUsers()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add label.")
    } finally {
      setAdding(null)
    }
  }

  const handleDiscordRole = async (action: "assign" | "remove") => {
    setDiscordAction(action)
    setDiscordPolling(true)
    setDiscordResult(null)
    setDiscordError(null)
    try {
      const executionId = await callFunctionAsync(DISCORD_ROLE_FUNCTION_ID, { action })
      toast.info(`${action === "assign" ? "Assigning" : "Removing"} roles... this may take a few minutes for many users.`)

      const result = await pollAndParseExecution<DiscordRoleResult>(DISCORD_ROLE_FUNCTION_ID, executionId, 5000)
      setDiscordResult(result)
      setDiscordPolling(false)
      toast.success(`${action === "assign" ? "Assigned" : "Removed"}: ${result.assigned || 0} success, ${result.failed} failed`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Discord role action failed."
      setDiscordError(msg)
      setDiscordPolling(false)
      toast.error(msg)
    } finally {
      setDiscordAction(null)
    }
  }

  const handleDownloadWhitelist = async () => {
    setDownloading(true)
    try {
      const result = await callFunction<WhitelistResult>(WHITELIST_FUNCTION_ID)
      const json = JSON.stringify(result.names, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "whitelist.json"
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${result.total} names.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.")
    } finally {
      setDownloading(false)
    }
  }

  if (accessLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/moderator")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Export & Event</h1>
        <ShieldCheck className="h-5 w-5 text-brand" />
      </div>

      {/* Section 1: Export */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm font-medium text-white">Run Export</p>
          <p className="text-xs text-white/40">
            Select top-rated finished applications up to a player limit and minimum rating threshold.
            Users get the <code className="text-brand/80">undergroundEventAccepted</code> label.
          </p>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-white/50">Max Players</label>
              <Input
                type="number"
                min={1}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-white/50">Min Rating %</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={minPercentage}
                onChange={(e) => setMinPercentage(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <Button className="w-full" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {exporting ? "Running..." : "Run Export"}
          </Button>

          {exportError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {exportError}
            </div>
          )}

          {exportResult && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-white">
                <span className="text-green-400 font-medium">{exportResult.accepted}</span> users accepted
                {exportResult.skipped > 0 && (
                  <span className="text-white/40">, {exportResult.skipped} already labeled</span>
                )}
                {exportResult.rolesAssigned !== undefined && (
                  <span className="ml-2">
                    <span className="text-green-400">{exportResult.rolesAssigned}</span> roles assigned
                    {exportResult.rolesFailed != null && exportResult.rolesFailed > 0 && (
                      <span className="text-red-400">, {exportResult.rolesFailed} failed</span>
                    )}
                  </span>
                )}
              </p>
              {exportResult.users.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {exportResult.users.map((u) => (
                    <div key={u.userId} className="flex items-center justify-between text-xs text-white/60">
                      <span>{u.discordUsername || u.minecraftIGN || u.userId}</span>
                      <span className="text-white/40">{u.rating}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Accepted Users Management */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Accepted Users</p>
            <Button variant="ghost" size="sm" onClick={fetchAcceptedUsers} disabled={loadingUsers}>
              Refresh
            </Button>
          </div>

          {loadError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {loadError}
            </div>
          )}

          {/* Manual Add */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Search by Discord name or IGN to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button variant="outline" size="sm" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {searchResults && searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                {searchResults.map((r) => (
                  <div key={r.userId} className="flex items-center justify-between px-3 py-2">
                    <div className="text-xs">
                      <span className="text-white">{r.discordUsername}</span>
                      <span className="text-white/40 ml-2">{r.minecraftIGN}</span>
                      <span className="text-white/30 ml-1">({r.rating}%)</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddUser(r.userId)}
                      disabled={adding === r.userId}
                    >
                      {adding === r.userId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {searchResults && searchResults.length === 0 && (
              <p className="text-xs text-white/30">No matching users found.</p>
            )}
          </div>

          {/* Accepted Users Table */}
          {loadingUsers ? (
            <div className="h-20 animate-pulse rounded bg-white/5" />
          ) : acceptedUsers.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-4">No accepted users yet.</p>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                {acceptedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{user.discordUsername || "Unknown"}</p>
                      <p className="text-xs text-white/40">
                        {user.minecraftIGN || "—"}
                        <span className="ml-2">({user.rating}%)</span>
                        {user.discordId && <span className="ml-2 text-white/20">{user.discordId}</span>}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 ml-2 shrink-0"
                      onClick={() => handleRemoveUser(user.userId)}
                      disabled={removing === user.userId}
                    >
                      {removing === user.userId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserMinus className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-white/30">{acceptedUsers.length} total</p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveAll}
                  disabled={removingAll}
                >
                  {removingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remove All
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Discord Roles */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm font-medium text-white">Discord Role</p>
          <p className="text-xs text-white/40">
            Assign or remove the event participant role in Discord for all accepted users.
            Refresh the accepted player list in Discord after bulk operations.
          </p>
          <div className="flex gap-3">
            <Button
              variant="default"
              className="flex-1"
              onClick={() => handleDiscordRole("assign")}
              disabled={discordAction !== null || discordPolling}
            >
              {discordAction === "assign" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {discordAction === "assign" ? "Processing..." : "Assign Role"}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleDiscordRole("remove")}
              disabled={discordAction !== null || discordPolling}
            >
              {discordAction === "remove" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {discordAction === "remove" ? "Processing..." : "Remove Role"}
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRefreshList}
            disabled={refreshingList}
          >
            {refreshingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Discord List
          </Button>

          {discordError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {discordError}
            </div>
          )}

          {discordResult && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-white">
                <span className="text-green-400 font-medium">{discordResult.assigned || 0}</span> success,{" "}
                <span className={discordResult.failed > 0 ? "text-red-400" : "text-white"}>
                  {discordResult.failed}
                </span>{" "}
                failed
              </p>
              {discordResult.failed > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto space-y-0.5">
                  {discordResult.details
                    .filter((d) => d.error)
                    .map((d) => (
                      <p key={d.userId} className="text-xs text-red-400/70">
                        {d.discordUsername}: {d.error}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Whitelist Export */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm font-medium text-white">Minecraft Whitelist</p>
          <p className="text-xs text-white/40">
            Download all Minecraft usernames of accepted users as a whitelist.json file.
          </p>
          <Button variant="outline" className="w-full" onClick={handleDownloadWhitelist} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download whitelist.json
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
