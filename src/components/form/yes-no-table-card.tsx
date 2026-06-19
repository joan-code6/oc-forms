import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useForm } from "@/hooks/use-form-state"
import { yesNoQuestions } from "@/lib/questions"

export function YesNoTableCard() {
  const { state, dispatch } = useForm()

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Some quick questions:</h2>
        <p className="text-sm text-white/50">
          Answer these yes/no questions to help us get to know you better.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-white/5 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
          <span>Questions</span>
          <span className="w-14 text-center">yes</span>
          <span className="w-14 text-center">no</span>
        </div>

        {yesNoQuestions.map((q, i) => (
          <div
            key={q.id}
            className={`grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3.5 items-center ${
              i < yesNoQuestions.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
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
        ))}
      </div>
    </div>
  )
}
