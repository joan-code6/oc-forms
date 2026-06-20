import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "@/hooks/use-form-state"
import { textQuestions, type TextQuestion } from "@/lib/questions"

interface TextQuestionsCardProps {
  questions?: TextQuestion[]
  title?: string
  description?: string
}

export function TextQuestionsCard({ questions, title, description }: TextQuestionsCardProps) {
  const { state, dispatch } = useForm()
  const displayQuestions = questions || textQuestions

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">{title || "Tell us about yourself"}</h2>
        <p className="text-sm text-white/50">
          {description || "A few more questions to get to know you and your playstyle."}
        </p>
      </div>

      {displayQuestions.map((q) => {
        const value = state.textAnswers[q.id] || ""
        const hasAnswer = value.trim().length > 0
        const isNearLimit = q.maxLength && value.length > q.maxLength * 0.9

        return (
          <div key={q.id} className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-white/80">
              {q.text}
              <Check className={`h-4 w-4 shrink-0 transition-opacity ${hasAnswer ? "text-green-400 opacity-100" : "opacity-0"}`} />
            </label>

            {q.type === "text" ? (
              <div className="max-w-md">
                <Input
                  value={value}
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
                  <p className={`mt-1.5 text-xs text-right ${isNearLimit ? "text-amber-400" : "text-white/30"}`}>
                    {value.length}/{q.maxLength}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <Textarea
                  value={value}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_TEXT",
                      questionId: q.id,
                      value: e.target.value,
                    })
                  }
                  placeholder={q.placeholder}
                  maxLength={q.maxLength}
                  className="min-h-[120px] sm:min-h-[140px]"
                />
                {q.maxLength && (
                  <p className={`mt-1.5 text-xs text-right ${isNearLimit ? "text-amber-400" : "text-white/30"}`}>
                    {value.length}/{q.maxLength}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
