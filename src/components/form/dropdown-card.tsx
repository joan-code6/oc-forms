import { Check } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useForm } from "@/hooks/use-form-state"
import { dropdownQuestions } from "@/lib/questions"

export function DropdownCard() {
  const { state, dispatch } = useForm()

  return (
    <div className="space-y-4">
      {dropdownQuestions.map((q) => {
        const hasValue = !!state.dropdownAnswers[q.id]

        return (
          <div key={q.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{q.text}</h2>
              <Check className={`h-4 w-4 shrink-0 transition-opacity ${hasValue ? "text-green-400 opacity-100" : "opacity-0"}`} />
            </div>

            <Select
              value={state.dropdownAnswers[q.id] || ""}
              onValueChange={(value) =>
                dispatch({ type: "SET_DROPDOWN", questionId: q.id, value })
              }
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder={q.placeholder || "Select an option..."} />
              </SelectTrigger>
              <SelectContent>
                {q.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      })}
    </div>
  )
}
