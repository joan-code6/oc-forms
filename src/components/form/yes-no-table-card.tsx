import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useForm } from "@/hooks/use-form-state"
import { yesNoQuestions } from "@/lib/questions"
import { Check } from "lucide-react"

export function YesNoTableCard() {
  const { state, dispatch } = useForm()

  const allAnswered = yesNoQuestions.every(
    (q) => state.yesNoAnswers[q.id] !== null && state.yesNoAnswers[q.id] !== undefined
  )

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">Some quick questions:</h2>
          <Check className={`h-4 w-4 shrink-0 transition-opacity ${allAnswered ? "text-green-400 opacity-100" : "opacity-0"}`} />
        </div>
        <p className="text-sm text-white/50">
          Answer these yes/no questions to help us get to know you better.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        {/* Desktop header */}
        <div className="hidden grid-cols-[1fr_auto_auto] gap-4 border-b border-white/5 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/40 sm:grid">
          <span>Questions</span>
          <span className="w-14 text-center">Yes</span>
          <span className="w-14 text-center">No</span>
        </div>

        {yesNoQuestions.map((q, i) => (
          <div
            key={q.id}
            className={`border-b border-white/5 last:border-b-0 ${
              i < yesNoQuestions.length - 1 ? "" : ""
            }`}
          >
            {/* Desktop layout */}
            <div className="hidden grid-cols-[1fr_auto_auto] gap-4 px-4 py-3.5 items-center sm:grid">
              <span className="text-sm text-white/80 pr-2">{q.text}</span>
              <RadioGroup
                value={
                  state.yesNoAnswers[q.id] === true
                    ? "yes"
                    : state.yesNoAnswers[q.id] === false
                      ? "no"
                      : undefined
                }
                onValueChange={(val) =>
                  dispatch({
                    type: "SET_YES_NO",
                    questionId: q.id,
                    value: val === "yes",
                  })
                }
                className="contents"
              >
                <div className="flex w-14 justify-center">
                  <RadioGroupItem value="yes" />
                </div>
                <div className="flex w-14 justify-center">
                  <RadioGroupItem value="no" />
                </div>
              </RadioGroup>
            </div>

            {/* Mobile layout */}
            <div className="px-4 py-3.5 sm:hidden">
              <p className="text-sm text-white/80 mb-3">{q.text}</p>
              <RadioGroup
                value={
                  state.yesNoAnswers[q.id] === true
                    ? "yes"
                    : state.yesNoAnswers[q.id] === false
                      ? "no"
                      : undefined
                }
                onValueChange={(val) =>
                  dispatch({
                    type: "SET_YES_NO",
                    questionId: q.id,
                    value: val === "yes",
                  })
                }
                className="flex gap-3"
              >
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                  <RadioGroupItem value="yes" />
                  <span className="text-sm text-white/80">Yes</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                  <RadioGroupItem value="no" />
                  <span className="text-sm text-white/80">No</span>
                </div>
              </RadioGroup>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
