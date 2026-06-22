import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useInviteAccess } from "@/hooks/use-invite-access"
import { useAppwriteAuth } from "@/hooks/use-appwrite-auth"
import { callFunction } from "@/lib/functions"
import { Link2, Copy, Check, LogOut, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

const CREATE_INVITE_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_CREATE_INVITE_ID || "create-invite-link"

interface CreateInviteResult {
  success: boolean
  code?: string
  url?: string
  error?: string
}

export function InviteDashboardPage() {
  const { allowed, loading: accessLoading, discordUsername } = useInviteAccess()
  const { logoutUser } = useAppwriteAuth()
  const navigate = useNavigate()

  const [generating, setGenerating] = useState(false)
  const [lastLink, setLastLink] = useState<{ code: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const result = await callFunction<CreateInviteResult>(CREATE_INVITE_FUNCTION_ID)
      if (result.success && result.code && result.url) {
        setLastLink({ code: result.code, url: result.url })
        toast.success("Invite link generated!")
      } else {
        toast.error(result.error || "Failed to generate invite link.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate invite link.")
    } finally {
      setGenerating(false)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    if (!lastLink) return
    try {
      await navigator.clipboard.writeText(lastLink.url)
      setCopied(true)
      toast.success("Link copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy link.")
    }
  }, [lastLink])

  const handleLogout = async () => {
    await logoutUser()
    navigate("/")
  }

  if (accessLoading || !allowed) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/moderator")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-white">Invite Links</h1>
        </div>
        <div className="flex items-center gap-3">
          {discordUsername && (
            <span className="text-sm text-white/40">{discordUsername}</span>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-white/60">
            Generate single-use invite links that let people submit applications
            instantly. Anyone opening the link will enter their Minecraft username,
            authenticate with Discord, and their application will be auto-approved
            with a 100% rating.
          </p>

          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={generating}
          >
            <Link2 className="h-5 w-5" />
            {generating ? "Generating..." : "Generate Invite Link"}
          </Button>

          {lastLink && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
                Your Invite Link
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white/10 px-3 py-2 text-sm text-white break-all">
                  {lastLink.url}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-white/30">
                Code: {lastLink.code} &middot; This link can only be used once.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
