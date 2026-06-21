import { useState, useEffect } from "react"
import { AlertCircle } from "lucide-react"
import { useMinecraftValidation } from "@/hooks/use-minecraft-validation"

interface AvatarCardProps {
  minecraftUsername: string
  onValidationChange?: (valid: boolean) => void
}

function SkinImages({ uuid, username }: { uuid: string; username: string }) {
  const [headFailed, setHeadFailed] = useState(false)
  const [bodyFailed, setBodyFailed] = useState(false)

  const headUrl = `https://mc-heads.net/head/${uuid}/160`
  const bodyUrl = `https://mc-heads.net/body/${uuid}/160`
  const showPlaceholder = bodyFailed

  if (showPlaceholder) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-white/5 to-transparent sm:h-56 sm:w-40">
        <span className="text-4xl font-bold text-white/20">?</span>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-4 sm:gap-6">
      {!headFailed && (
        <img
          src={headUrl}
          alt={`Minecraft skin head for ${username}`}
          className="h-16 w-16 sm:h-24 sm:w-24"
          style={{ imageRendering: "pixelated" }}
          onError={() => setHeadFailed(true)}
        />
      )}
      {!bodyFailed && (
        <img
          src={bodyUrl}
          alt={`Minecraft skin body for ${username}`}
          className="h-32 w-16 sm:h-40 sm:w-20"
          style={{ imageRendering: "pixelated" }}
          onError={() => setBodyFailed(true)}
        />
      )}
    </div>
  )
}

export function AvatarCard({ minecraftUsername, onValidationChange }: AvatarCardProps) {
  const { data, isLoading } = useMinecraftValidation(minecraftUsername)

  const hasUsername = minecraftUsername.trim().length >= 3
  const isValid = data?.success === true
  const isInvalid = data?.success === false && !isLoading && hasUsername

  const uuid = data?.uuid || null

  useEffect(() => {
    onValidationChange?.(isValid)
  }, [isValid, onValidationChange])

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Make sure that this is you!</h2>
        <p className="text-sm text-white/50">
          We use your Minecraft skin to verify your identity. Both layers
          (base + helmet/overlay) are shown.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-white/10 bg-white/[0.02] p-8">
        {isLoading ? (
          <div className="flex h-48 w-full items-center justify-center sm:h-56 sm:w-40">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          </div>
        ) : uuid ? (
          <SkinImages key={uuid} uuid={uuid} username={minecraftUsername} />
        ) : (
          <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-white/5 to-transparent sm:h-56 sm:w-40">
            <span className="text-4xl font-bold text-white/20">?</span>
          </div>
        )}

        <div className="text-center">
          <p className="text-sm font-medium text-white/80">
            {hasUsername ? minecraftUsername : "Enter your IGN above"}
          </p>

          {isInvalid && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {data?.error || "Account not found"}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
