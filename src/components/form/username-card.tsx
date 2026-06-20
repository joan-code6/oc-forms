import { Check, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useForm } from "@/hooks/use-form-state"

export function UsernameCard() {
  const { state, dispatch } = useForm()

  const ign = state.minecraftIGN
  const hasValue = ign.trim().length >= 3
  const isValidFormat = /^[a-zA-Z0-9_]+$/.test(ign)
  const hasError = ign.length > 0 && (!hasValue || !isValidFormat)
  const isValid = hasValue && isValidFormat

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">What's your Minecraft Username?</h2>
          <Check className={`h-4 w-4 shrink-0 transition-opacity ${isValid ? "text-green-400 opacity-100" : "opacity-0"}`} />
        </div>
        <p className="text-sm text-white/50">
          Enter your Java Edition in-game name (IGN) so we can verify your account.
        </p>
      </div>

      <div className="max-w-md">
        <label className="mb-2 block text-sm font-medium text-white/70">
          Minecraft IGN
        </label>
        <div className="relative">
          <Input
            value={ign}
            onChange={(e) => dispatch({ type: "SET_IGN", ign: e.target.value })}
            placeholder="IGN"
            maxLength={16}
            className={hasError ? "border-red-500/50 focus-visible:ring-red-500/30" : isValid ? "border-green-500/30" : ""}
          />
          {isValid && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Check className="h-4 w-4 text-green-400" />
            </div>
          )}
        </div>
        {hasError && (
          <p className="mt-2 flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {!isValidFormat
              ? "Only letters, numbers, and underscores allowed."
              : "Must be at least 3 characters."}
          </p>
        )}
        {!hasError && (
          <p className="mt-2 text-xs text-white/30">
            3-16 characters, letters, numbers, and underscores only.
          </p>
        )}
      </div>
    </div>
  )
}
