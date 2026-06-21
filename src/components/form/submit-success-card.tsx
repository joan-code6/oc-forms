import { ArrowRight, Check, Loader2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

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
  const navigate = useNavigate()

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-green-500/20 bg-green-500/[0.03] p-6 text-center sm:p-10">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20 sm:mb-6 sm:h-24 sm:w-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 sm:h-16 sm:w-16">
            <Check className="h-7 w-7 text-green-400 sm:h-8 sm:w-8" strokeWidth={3} />
          </div>
        </div>

        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Thank you for submitting!</h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/50 sm:text-base">
          We will review your application and inform you when we have made our decision.
        </p>

        <Button
          onClick={() => navigate("/preview-images")}
          variant="outline"
          className="mt-6 gap-2"
        >
          <Eye className="h-4 w-4" />
          Sneak peek of the maps
        </Button>

        <p className="mt-6 text-xs text-white/30">
          You can close this page now. If you have any questions, reach out on the OutCraft Discord.
        </p>
      </div>
    )
  }

  return (
    <Button
      onClick={onSubmit}
      disabled={disabled || isSubmitting}
      size="xl"
      className={`min-w-[220px] gap-3 text-base ${!disabled && !isSubmitting ? "submit-glow" : ""}`}
    >
      {isSubmitting ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Submitting...
        </>
      ) : (
        <>
          Submit
          <ArrowRight className="h-5 w-5" />
        </>
      )}
    </Button>
  )
}
