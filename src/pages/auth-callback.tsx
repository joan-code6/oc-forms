import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAppwriteAuth } from "@/hooks/use-appwrite-auth"

export function AuthCallback() {
  const { user, loading, error, refetch } = useAppwriteAuth()
  const navigate = useNavigate()

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true })
    }
  }, [loading, user, navigate])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-white/50">Verifying your Discord account...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-red-400">Authentication failed: {error}</p>
      </div>
    )
  }

  return null
}
