import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useModeratorAccess } from "@/hooks/use-moderator-access"
import { callFunction } from "@/lib/functions"
import { ArrowLeft, AlertTriangle, ShieldCheck, Save } from "lucide-react"

const GET_SETTINGS_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_SETTINGS_ID || "get-app-settings"
const UPDATE_SETTINGS_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_UPDATE_SETTINGS_ID || "update-app-settings"

interface SettingsData {
  appsPaused: boolean
  doubleReviewEnabled: boolean
  conflictThreshold: number
}

export function ModeratorSettingsPage() {
  const { allowed, loading: accessLoading } = useModeratorAccess()
  const navigate = useNavigate()

  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [thresholdValue, setThresholdValue] = useState<string>("")
  const [thresholdSaving, setThresholdSaving] = useState(false)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    callFunction<SettingsData>(GET_SETTINGS_FUNCTION_ID)
      .then((result) => {
        if (!cancelled) {
          setSettings(result)
          setThresholdValue(String(result.conflictThreshold))
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load settings.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [allowed])

  if (accessLoading || !allowed) return null

  const toggle = async (key: "appsPaused" | "doubleReviewEnabled", value: boolean) => {
    if (!settings) return
    setSaving(true)
    setSaveError(null)
    try {
      const result = await callFunction<{ success: boolean; error?: string }>(
        UPDATE_SETTINGS_FUNCTION_ID,
        { [key]: value }
      )
      if (result.success) {
        setSettings({ ...settings, [key]: value })
      } else {
        setSaveError(result.error || "Failed to update.")
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  const saveThreshold = async () => {
    if (!settings) return
    const parsed = parseInt(thresholdValue, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      setSaveError("Threshold must be between 1 and 100.")
      return
    }
    setThresholdSaving(true)
    setSaveError(null)
    try {
      const result = await callFunction<{ success: boolean; error?: string }>(
        UPDATE_SETTINGS_FUNCTION_ID,
        { conflictThreshold: parsed }
      )
      if (result.success) {
        setSettings({ ...settings, conflictThreshold: parsed })
      } else {
        setSaveError(result.error || "Failed to update threshold.")
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save threshold.")
    } finally {
      setThresholdSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/moderator")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <ShieldCheck className="h-5 w-5 text-brand" />
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : settings ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Pause Applications</p>
                <p className="text-xs text-white/40">
                  {settings.appsPaused ? "Applications are paused." : "Applications are open."}
                </p>
              </div>
              <Button
                variant={settings.appsPaused ? "default" : "outline"}
                size="sm"
                disabled={saving}
                onClick={() => toggle("appsPaused", !settings.appsPaused)}
              >
                {settings.appsPaused ? "Resume" : "Pause"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Double Review Mode</p>
                <p className="text-xs text-white/40">
                  {settings.doubleReviewEnabled
                    ? "Each app gets reviewed by two moderators."
                    : "Single moderator reviews each application."}
                </p>
              </div>
              <Button
                variant={settings.doubleReviewEnabled ? "default" : "outline"}
                size="sm"
                disabled={saving}
                onClick={() => toggle("doubleReviewEnabled", !settings.doubleReviewEnabled)}
              >
                {settings.doubleReviewEnabled ? "Disable" : "Enable"}
              </Button>
            </CardContent>
          </Card>

          {settings.doubleReviewEnabled && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Conflict Threshold</p>
                    <p className="text-xs text-white/40">
                      Minimum rating difference (1-100%) to flag as a conflict.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={thresholdValue}
                      onChange={(e) => setThresholdValue(e.target.value)}
                      className="w-20 text-right"
                      disabled={thresholdSaving}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={thresholdSaving || thresholdValue === String(settings.conflictThreshold)}
                      onClick={saveThreshold}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {saveError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
