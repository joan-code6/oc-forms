import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction } from "@/lib/functions"
import { ClipboardCheck, LogOut, AlertTriangle, BookOpen, Settings, ShieldAlert, Link2, Clock, Download, Users, BarChart3 } from "lucide-react"
import { useAppwriteAuth } from "@/hooks/use-appwrite-auth"

const STATS_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_STATS_ID || "get-moderator-stats"
const NEXT_APP_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_NEXT_APP_ID || "get-next-application"

interface StatsResult {
  openApplications: number
  totalClosed: number
  reviewedByYou: number
}

interface NextAppResult {
  application: { id: string } | null
}

export function ModeratorDashboardPage() {
  const { allowed, loading: accessLoading, isAdmin, isFasttrack, discordUsername } = useModeratorAccess()
  const { logoutUser } = useAppwriteAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState<StatsResult | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [fetchingNext, setFetchingNext] = useState(false)
  const [emptyQueue, setEmptyQueue] = useState(false)
  const [nextError, setNextError] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    callFunction<StatsResult>(STATS_FUNCTION_ID)
      .then((data) => {
        if (!cancelled) {
          setStats(data)
          setStatsError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setStatsError(e instanceof Error ? e.message : "Failed to load stats.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStats(false)
      })
    return () => { cancelled = true }
  }, [allowed])

  const handleEvaluate = async () => {
    setFetchingNext(true)
    setEmptyQueue(false)
    setNextError(null)
    try {
      const result = await callFunction<NextAppResult>(NEXT_APP_FUNCTION_ID)
      if (result.application) {
        navigate("/moderator/review", { state: { applicationId: result.application.id } })
      } else {
        setEmptyQueue(true)
      }
    } catch (e) {
      setNextError(e instanceof Error ? e.message : "Failed to load application.")
    } finally {
      setFetchingNext(false)
    }
  }

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
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-4">
              <Skeleton className="h-20 flex-1 rounded-lg" />
              <Skeleton className="h-20 flex-1 rounded-lg" />
              <Skeleton className="h-20 flex-1 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Moderator Dashboard</h1>
        <div className="flex items-center gap-3">
          {discordUsername && (
            <span className="text-sm text-white/40">{discordUsername}</span>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {statsError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {statsError}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-white/50">Open Applications</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {loadingStats ? "..." : stats?.openApplications ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-white/50">Total Closed</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {loadingStats ? "..." : stats?.totalClosed ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-white/50">Reviewed by You</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {loadingStats ? "..." : stats?.reviewedByYou ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={handleEvaluate}
            disabled={fetchingNext}
          >
            <ClipboardCheck className="h-5 w-5" />
            {fetchingNext ? "Loading..." : "Evaluate Applications"}
          </Button>

          {emptyQueue && (
            <p className="text-center text-sm text-white/40">
              No applications waiting for review.
            </p>
          )}

          {nextError && (
            <div className="flex items-center justify-center gap-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {nextError}
            </div>
          )}
        </CardContent>
      </Card>

      {isFasttrack && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Fast-Track</p>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/invites")}
            >
              <Link2 className="h-4 w-4" />
              Generate Invite Links
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Admin</p>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/moderator/statistics")}
            >
              <BarChart3 className="h-4 w-4" />
              Statistics
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/moderator/unscored")}
            >
              <Clock className="h-4 w-4" />
              Unscored Applications
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/moderator/audit")}
            >
              <BookOpen className="h-4 w-4" />
              Audit Log
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/moderator/conflicts")}
            >
              <ShieldAlert className="h-4 w-4" />
              Conflicts
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/moderator/applications")}
            >
              <Users className="h-4 w-4" />
              Applications
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/moderator/export")}
            >
              <Download className="h-4 w-4" />
              Export & Event
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/moderator/settings")}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
