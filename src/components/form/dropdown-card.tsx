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
      {dropdownQuestions.map((q) => (
        <div key={q.id} className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">{q.text}</h2>

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
      ))}
    </div>
  )
}
