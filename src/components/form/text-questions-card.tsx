import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "@/hooks/use-form-state"
import { textQuestions } from "@/lib/questions"

export function TextQuestionsCard() {
  const { state, dispatch } = useForm()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Tell us about yourself</h2>
        <p className="text-sm text-white/50">
          A few more questions to get to know you and your playstyle.
        </p>
      </div>

      {textQuestions.map((q) => (
        <div key={q.id} className="space-y-2">
          <label className="block text-sm font-medium text-white/80">
            {q.text}
          </label>

          {q.type === "text" ? (
            <div className="max-w-md">
              <Input
                value={state.textAnswers[q.id] || ""}
                onChange={(e) =>
                  dispatch({
                    type: "SET_TEXT",
                    questionId: q.id,
                    value: e.target.value,
                  })
                }
                placeholder={q.placeholder}
                maxLength={q.maxLength}
              />
              {q.maxLength && (
                <p className="mt-1.5 text-xs text-white/30 text-right">
                  {(state.textAnswers[q.id] || "").length}/{q.maxLength}
                </p>
              )}
            </div>
          ) : (
            <div>
              <Textarea
                value={state.textAnswers[q.id] || ""}
                onChange={(e) =>
                  dispatch({
                    type: "SET_TEXT",
                    questionId: q.id,
                    value: e.target.value,
                  })
                }
                placeholder={q.placeholder}
                maxLength={q.maxLength}
                className="min-h-[140px]"
              />
              {q.maxLength && (
                <p className="mt-1.5 text-xs text-white/30 text-right">
                  {(state.textAnswers[q.id] || "").length}/{q.maxLength}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
