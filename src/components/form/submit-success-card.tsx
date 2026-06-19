import { ArrowRight, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SubmitSuccessCardProps {
  isSubmitting: boolean
  submitted: boolean
  disabled: boolean
  onSubmit: () => void
}

export function SubmitSuccessCard({
  isSubmitting,
  submitted,
  disabled,
  onSubmit,
}: SubmitSuccessCardProps) {
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-green-500/20 bg-green-500/[0.03] p-10 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
            <Check className="h-8 w-8 text-green-400" strokeWidth={3} />
          </div>
        </div>

        <h2 className="text-2xl font-bold tracking-tight">Thank you for submitting!</h2>
        <p className="mt-3 max-w-sm text-white/50 leading-relaxed">
          We will review your application and inform you when we have made our decision.
        </p>

        <p className="mt-6 text-xs text-white/30">
          You can close this page now. If you have any questions, reach out on the OutCraft Discord.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Button
        onClick={onSubmit}
        disabled={disabled || isSubmitting}
        size="xl"
        className="min-w-[220px] gap-3 text-base"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            submit
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </Button>
    </div>
  )
}
