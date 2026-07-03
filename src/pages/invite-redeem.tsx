import { useState, useCallback, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppwriteAuth } from "@/hooks/use-appwrite-auth"
import { useMinecraftValidation } from "@/hooks/use-minecraft-validation"
import { callFunction } from "@/lib/functions"
import { captureEvent } from "@/lib/posthog"
import { LogIn, Send, CheckCircle2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { BackgroundSlideshow } from "@/components/background-slideshow"

const REDEEM_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_REDEEM_INVITE_ID || "redeem-invite-link"

const SUBMITTED_KEY = "outcraft-fasttrack-submitted"

interface RedeemInviteResult {
  success: boolean
  documentId?: string
  error?: string
}

export function InviteRedeemPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading, loginWithDiscord } = useAppwriteAuth()

  useEffect(() => {
    if (code) {
      captureEvent("invite_viewed", { invite_code: code })
    }
  }, [code])

  const [minecraftIGN, setMinecraftIGN] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(() => {
    try {
      return localStorage.getItem(SUBMITTED_KEY) === "true"
    } catch {
      return false
    }
  })

  const { data: minecraftData } = useMinecraftValidation(minecraftIGN)
  const isMCValid = minecraftData?.success === true
  const isReady = !!user && !authLoading && isMCValid && minecraftIGN.trim().length >= 3

  const handleRedeem = useCallback(async () => {
    if (!isReady || !code) return

    setSubmitting(true)
    try {
      const result = await callFunction<RedeemInviteResult>(REDEEM_FUNCTION_ID, {
        code,
        minecraftIGN: minecraftIGN.trim(),
      })

      if (result.success) {
        setSubmitted(true)
        captureEvent("invite_redeemed", {
          invite_code: code,
          minecraft_ign: minecraftIGN.trim(),
        })
        try {
          localStorage.setItem(SUBMITTED_KEY, "true")
        } catch { /* ignore */ }
        toast.success("Application submitted successfully!")
      } else {
        captureEvent("invite_redeem_error", {
          invite_code: code,
          error: result.error || "unknown",
        })
        toast.error(result.error || "Failed to submit application.")
      }
    } catch (e) {
      captureEvent("invite_redeem_error", {
        invite_code: code,
        error: e instanceof Error ? e.message : "network_error",
      })
      toast.error(e instanceof Error ? e.message : "Failed to submit application.")
    } finally {
      setSubmitting(false)
    }
  }, [isReady, code, minecraftIGN])

  if (!code) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <Card>
          <CardContent className="p-8 space-y-4">
            <p className="text-lg text-white/60">Invalid invite link.</p>
            <Button variant="outline" onClick={() => navigate("/")}>
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card className="form-card">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
            <h1 className="text-xl font-semibold text-white">Application Submitted!</h1>
            <p className="text-sm text-white/60">
              Your application has been submitted and automatically reviewed.
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-12">
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-11 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <BackgroundSlideshow />
      <div className="mx-auto max-w-xl space-y-6 px-4 pb-24 pt-8 md:pt-12">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Fast-Track Application</h1>
            <p className="text-sm text-white/40">Invite code: {code}</p>
          </div>
        </div>

        {!user && (
          <Card className="form-card animate-in">
            <CardContent className="p-8 text-center space-y-4">
              <p className="text-white/70">
                You need to verify with Discord before continuing.
              </p>
              <Button size="lg" onClick={loginWithDiscord} className="gap-2">
                <LogIn className="h-4 w-4" />
                Verify with Discord
              </Button>
            </CardContent>
          </Card>
        )}

        {user && (
          <Card className="form-card animate-in">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label htmlFor="fasttrack-ign" className="text-sm font-medium text-white/80">
                  Minecraft Username
                </label>
                <Input
                  id="fasttrack-ign"
                  placeholder="Enter your Minecraft username"
                  value={minecraftIGN}
                  onChange={(e) => setMinecraftIGN(e.target.value)}
                  maxLength={16}
                  disabled={submitting}
                />
                {minecraftIGN.trim().length > 0 && minecraftIGN.trim().length < 3 && (
                  <p className="text-xs text-amber-400/80">
                    Username must be at least 3 characters.
                  </p>
                )}
                {minecraftIGN.trim().length >= 3 && !isMCValid && (
                  <p className="text-xs text-amber-400/80">
                    This doesn't appear to be a valid Minecraft account.
                  </p>
                )}
                {isMCValid && (
                  <p className="text-xs text-green-400/80">
                    Minecraft account found: {minecraftIGN}
                  </p>
                )}
              </div>

              <p className="text-xs text-white/30">
                By submitting, your application will be automatically reviewed and
                approved with a 100% rating.
              </p>

              <Button
                className="w-full"
                size="lg"
                disabled={!isReady || submitting}
                onClick={handleRedeem}
              >
                {submitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Application
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
