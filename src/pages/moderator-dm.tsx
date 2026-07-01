import { useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction } from "@/lib/functions"
import { toast } from "sonner"
import {
  ArrowLeft,
  ShieldCheck,
  Send,
  Loader2,
  AlertTriangle,
  Bug,
  CheckCircle2,
  XCircle,
} from "lucide-react"

const DM_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_SEND_DM_ID || "send-discord-dms"

interface PreviewUser {
  id: string
  userId: string
  discordUsername: string
  discordId: string
  minecraftIGN: string
  rating: number
}

interface PreviewResult {
  success: boolean
  action: string
  total: number
  users: PreviewUser[]
  hasMore: boolean
}

interface SendResult {
  success: boolean
  action: string
  sent: number
  failed: number
  total: number
  details: { userId?: string; discordUsername?: string; discordId?: string; status?: string; error?: string }[]
}

const DEFAULT_TEST_MESSAGE = "Hello! This is a test message from the OutCraft team. If you received this, our notification system is working. Have a great day!"

export function ModeratorDmPage() {
  const { allowed, loading: accessLoading, isAdmin } = useModeratorAccess()
  const navigate = useNavigate()

  const [debugMode, setDebugMode] = useState(true)
  const [message, setMessage] = useState(DEFAULT_TEST_MESSAGE)

  const [previewUsers, setPreviewUsers] = useState<PreviewUser[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewHasMore, setPreviewHasMore] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingMorePreview, setLoadingMorePreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const DM_PAGE_SIZE = 50;

  const fetchPreview = useCallback(async (offset = 0, append = false) => {
    const result = await callFunction<PreviewResult>(DM_FUNCTION_ID, {
      action: "preview",
      offset,
      limit: DM_PAGE_SIZE,
    })
    if (append) {
      setPreviewUsers((prev) => [...prev, ...result.users])
    } else {
      setPreviewUsers(result.users)
    }
    setPreviewTotal(result.total)
    setPreviewHasMore(result.hasMore)
  }, [])

  const loadInitialPreview = async () => {
    setLoadingPreview(true)
    setPreviewError(null)
    setSendResult(null)
    setSendError(null)
    try {
      await fetchPreview(0, false)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Failed to load preview.")
    } finally {
      setLoadingPreview(false)
    }
  }

  const loadMorePreview = async () => {
    setLoadingMorePreview(true)
    try {
      await fetchPreview(previewUsers.length, true)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Failed to load more.")
    } finally {
      setLoadingMorePreview(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadInitialPreview()
    }
  }, [isAdmin])

  const toggleUser = (discordId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(discordId)) {
        next.delete(discordId)
      } else {
        next.add(discordId)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedUserIds.size === previewUsers.filter((u) => u.discordId).length) {
      setSelectedUserIds(new Set())
    } else {
      setSelectedUserIds(new Set(previewUsers.filter((u) => u.discordId).map((u) => u.discordId)))
    }
  }

  const selectedUsers = previewUsers.filter((u) => u.discordId && selectedUserIds.has(u.discordId))
  const targetDiscordIds = selectedUsers.map((u) => u.discordId)

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Message cannot be empty.")
      return
    }

    if (debugMode) {
      if (targetDiscordIds.length === 0) {
        toast.error("Select at least one user to send a test DM.")
        return
      }
      if (!confirm(`Send test DM to ${selectedUsers.length} selected user(s)?`)) return
    } else {
      const recipientCount = previewUsers.filter((u) => u.discordId).length
      if (recipientCount === 0) {
        toast.error("No users with Discord IDs found.")
        return
      }
      if (!confirm(`Send DM to ALL ${recipientCount} accepted users? This cannot be undone.`)) return
    }

    setSending(true)
    setSendResult(null)
    setSendError(null)

    try {
      const action = debugMode ? "send-test" : "send"
      const body: Record<string, unknown> = { action, message: message.trim() }
      if (debugMode) {
        body.targetDiscordIds = targetDiscordIds
      }

      const result = await callFunction<SendResult>(DM_FUNCTION_ID, body)
      setSendResult(result)
      if (result.failed > 0) {
        toast.warning(`${result.sent} sent, ${result.failed} failed.`)
      } else {
        toast.success(`${result.sent} DM(s) sent successfully.`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send DMs."
      setSendError(msg)
      toast.error(msg)
    } finally {
      setSending(false)
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

  const usersWithDiscord = previewUsers.filter((u) => u.discordId)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/moderator")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Discord DMs</h1>
        <Bug className="h-5 w-5 text-brand" />
      </div>

      {/* Debug Mode Toggle */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Debug Mode</p>
              <p className="text-xs text-white/40">
                {debugMode
                  ? "Preview recipients and send test DMs to selected users only."
                  : "Live mode: sends DMs to ALL accepted users."}
              </p>
            </div>
            <Button
              variant={debugMode ? "default" : "destructive"}
              size="sm"
              onClick={() => {
                setDebugMode(!debugMode)
                setSendResult(null)
                setSendError(null)
              }}
            >
              <Bug className="h-3.5 w-3.5" />
              {debugMode ? "Debug ON" : "Debug OFF (LIVE)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recipient Preview */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">
              Recipients
              <span className="text-white/40 ml-1">
                {loadingPreview ? "..." : `(${usersWithDiscord.length}${previewTotal > usersWithDiscord.length ? ` of ${previewTotal}` : ""})`}
              </span>
            </p>
            <div className="flex items-center gap-2">
              {debugMode && usersWithDiscord.length > 0 && (
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedUserIds.size === usersWithDiscord.length ? "Deselect All" : "Select All"}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={loadInitialPreview} disabled={loadingPreview}>
                Refresh
              </Button>
            </div>
          </div>

          {previewError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {previewError}
            </div>
          )}

          {loadingPreview ? (
            <div className="h-32 animate-pulse rounded bg-white/5" />
          ) : usersWithDiscord.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-4">No accepted users with Discord IDs found.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
              {usersWithDiscord.map((user) => (
                <div
                  key={user.discordId}
                  className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors ${
                    debugMode && selectedUserIds.has(user.discordId) ? "bg-brand/10" : ""
                  }`}
                  onClick={() => debugMode && toggleUser(user.discordId)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{user.discordUsername || "Unknown"}</p>
                    <p className="text-xs text-white/40">
                      {user.minecraftIGN || "—"}
                      <span className="ml-2">({user.rating}%)</span>
                      <span className="ml-2 text-white/20">{user.discordId}</span>
                    </p>
                  </div>
                  {debugMode && (
                    <div className={`ml-2 h-5 w-5 shrink-0 rounded border ${
                      selectedUserIds.has(user.discordId)
                        ? "border-brand bg-brand/30 flex items-center justify-center"
                        : "border-white/20"
                    }`}>
                      {selectedUserIds.has(user.discordId) && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {previewHasMore && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMorePreview} disabled={loadingMorePreview}>
                {loadingMorePreview ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Load more
              </Button>
            </div>
          )}

          {debugMode && selectedUsers.length > 0 && (
            <p className="text-xs text-brand">
              {selectedUsers.length} user(s) selected
            </p>
          )}
        </CardContent>
      </Card>

      {/* Message */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm font-medium text-white">Message</p>
          <textarea
            className="w-full min-h-32 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-brand/40 focus:outline-none resize-y"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter the message to send via Discord DM..."
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/30">{message.length} characters</p>
            {!debugMode && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Live mode: sends to ALL accepted users
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Send Button */}
      <Button
        className="w-full"
        size="lg"
        variant={debugMode ? "default" : "destructive"}
        onClick={handleSend}
        disabled={sending}
      >
        {sending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : debugMode ? (
          <Send className="h-5 w-5" />
        ) : (
          <Send className="h-5 w-5" />
        )}
        {sending
          ? "Sending..."
          : debugMode
            ? targetDiscordIds.length > 0
              ? `Send Test to ${targetDiscordIds.length} User(s)`
              : "Select Users to Send Test"
            : `Send to ALL ${usersWithDiscord.length} Users`}
      </Button>

      {/* Send Result */}
      {sendError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {sendError}
        </div>
      )}

      {sendResult && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium text-white">Result</p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {sendResult.sent} sent
              </span>
              {sendResult.failed > 0 && (
                <span className="text-red-400 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {sendResult.failed} failed
                </span>
              )}
            </div>
            {sendResult.details.filter((d) => d.error).length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-white/5 divide-y divide-white/5">
                {sendResult.details
                  .filter((d) => d.error)
                  .map((d, i) => (
                    <div key={i} className="px-3 py-2">
                      <p className="text-xs text-white/60">{d.discordUsername || d.discordId || "Unknown"}</p>
                      <p className="text-xs text-red-400/70">{d.error}</p>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
