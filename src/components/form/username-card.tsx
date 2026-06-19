import { Input } from "@/components/ui/input"
import { useForm } from "@/hooks/use-form-state"

export function UsernameCard() {
  const { state, dispatch } = useForm()

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">What's your Minecraft Username?</h2>
        <p className="text-sm text-white/50">
          Enter your Java Edition in-game name (IGN) so we can verify your account.
        </p>
      </div>

      <div className="max-w-md">
        <label className="mb-2 block text-sm font-medium text-white/70">
          Minecraft IGN
        </label>
        <Input
          value={state.minecraftIGN}
          onChange={(e) => dispatch({ type: "SET_IGN", ign: e.target.value })}
          placeholder="IGN"
          maxLength={16}
        />
        <p className="mt-2 text-xs text-white/30">
          3-16 characters, letters, numbers, and underscores only.
        </p>
      </div>
    </div>
  )
}
