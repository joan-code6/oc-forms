import { useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppwriteAuth } from "@/hooks/use-appwrite-auth"
import { useMinecraftValidation } from "@/hooks/use-minecraft-validation"
import { callFunction } from "@/lib/functions"
import { captureEvent } from "@/lib/posthog"
import { LogIn, Send, CheckCircle2, ShieldCheck, ArrowLeft, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { BackgroundSlideshow } from "@/components/background-slideshow"

const VERIFY_VIP_FUNCTION_ID = "verify-vip-access"
const SUBMIT_VIP_FUNCTION_ID = "submit-vip"
const SUBMITTED_KEY = "outcraft-vip-submitted"

interface VerifyVipResult {
  allowed: boolean
  discordId?: string
  discordUsername?: string
}

interface SubmitVipResult {
  success: boolean
  alreadyAccepted?: boolean
  discordUsername?: string
  minecraftIGN?: string
  error?: string
}

export function VipVerifyPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading, loginWithDiscord } = useAppwriteAuth()

  const [vipVerified, setVipVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [vipDenied, setVipDenied] = useState(false)
  const [discordUsername, setDiscordUsername] = useState("")

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
  const isReady = vipVerified && isMCValid && minecraftIGN.trim().length >= 3

  useEffect(() => {
    captureEvent("vip_page_viewed")
  }, [])

  useEffect(() => {
    if (!user || verifying || vipVerified || vipDenied) return

    let cancelled = false
    setVerifying(true)

    callFunction<VerifyVipResult>(VERIFY_VIP_FUNCTION_ID)
      .then((result) => {
        if (cancelled) return
        setVerifying(false)
        if (result.allowed) {
          setVipVerified(true)
          setDiscordUsername(result.discordUsername || "")
          captureEvent("vip_verified", { discord_username: result.discordUsername })
        } else {
          setVipDenied(true)
          captureEvent("vip_denied")
        }
      })
      .catch(() => {
        if (cancelled) return
        setVerifying(false)
        setVipDenied(true)
      })

    return () => { cancelled = true }
  }, [user, verifying, vipVerified, vipDenied])

  const handleSubmit = useCallback(async () => {
    if (!isReady) return

    setSubmitting(true)
    try {
      const result = await callFunction<SubmitVipResult>(SUBMIT_VIP_FUNCTION_ID, {
        minecraftIGN: minecraftIGN.trim(),
      })

      if (result.success) {
        setSubmitted(true)
        captureEvent("vip_submitted", {
          minecraft_ign: minecraftIGN.trim(),
          already_accepted: result.alreadyAccepted,
        })
        try {
          localStorage.setItem(SUBMITTED_KEY, "true")
        } catch { /* ignore */ }
        if (result.alreadyAccepted) {
          toast.success("You are already registered as VIP!")
        } else {
          toast.success("VIP registration complete! You are now on the whitelist.")
        }
      } else {
        captureEvent("vip_submit_error", {
          error: result.error || "unknown",
        })
        toast.error(result.error || "Failed to register.")
      }
    } catch (e) {
      captureEvent("vip_submit_error", {
        error: e instanceof Error ? e.message : "network_error",
      })
      toast.error(e instanceof Error ? e.message : "Failed to register.")
    } finally {
      setSubmitting(false)
    }
  }, [isReady, minecraftIGN])

  if (submitted) {
    return (
      <>
        <BackgroundSlideshow />
        <div className="mx-auto max-w-xl px-4 py-12">
          <Card className="form-card">
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
              <h1 className="text-xl font-semibold text-white">VIP Registered!</h1>
              <p className="text-sm text-white/60">
                Your Minecraft username has been added to the accepted list.
                You will appear in the next whitelist export.
              </p>
              <Button variant="outline" onClick={() => navigate("/")}>
                Return Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (authLoading || verifying) {
    return (
      <>
        <BackgroundSlideshow />
        <div className="mx-auto max-w-xl space-y-6 px-4 py-12">
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-11 w-full" />
            </CardContent>
          </Card>
        </div>
      </>
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
            <h1 className="text-2xl font-bold text-white">VIP Verification</h1>
            <p className="text-sm text-white/40">Link your Discord and Minecraft account</p>
          </div>
        </div>

        {!user && (
          <Card className="form-card animate-in">
            <CardContent className="p-8 text-center space-y-4">
              <ShieldCheck className="mx-auto h-12 w-12 text-amber-400" />
              <p className="text-white/70">
                Verify with Discord to check your VIP status.
              </p>
              <Button size="lg" onClick={loginWithDiscord} className="gap-2">
                <LogIn className="h-4 w-4" />
                Verify with Discord
              </Button>
            </CardContent>
          </Card>
        )}

        {user && vipDenied && (
          <Card className="form-card animate-in">
            <CardContent className="p-8 text-center space-y-4">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
              <h2 className="text-lg font-semibold text-white">Access Denied</h2>
              <p className="text-sm text-white/60">
                You do not have the VIP role. If you believe this is a mistake,
                please contact a server administrator.
              </p>
              <Button variant="outline" onClick={() => navigate("/")}>
                Return Home
              </Button>
            </CardContent>
          </Card>
        )}

        {vipVerified && (
          <Card className="form-card animate-in">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-400">VIP Verified</p>
                  <p className="text-xs text-white/50">
                    Logged in as {discordUsername || user.name}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="vip-ign" className="text-sm font-medium text-white/80">
                  Minecraft Username
                </label>
                <Input
                  id="vip-ign"
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
                Your Minecraft username will be added to the whitelist. Make sure
                it is correct before submitting.
              </p>

              <Button
                className="w-full"
                size="lg"
                disabled={!isReady || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  "Registering..."
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Register for Whitelist
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
