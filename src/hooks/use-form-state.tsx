import { createContext, useContext, useReducer, useCallback, useEffect, useMemo, type ReactNode } from "react"
import { yesNoQuestions, dropdownQuestions, textQuestions } from "@/lib/questions"

export type YesNoAnswers = Record<string, boolean | null>
export type DropdownAnswers = Record<string, string | undefined>
export type TextAnswers = Record<string, string>

interface FormState {
  currentPage: number
  minecraftIGN: string
  timezone: string
  yesNoAnswers: YesNoAnswers
  dropdownAnswers: DropdownAnswers
  textAnswers: TextAnswers
  isSubmitting: boolean
  submitted: boolean
  validationErrors: string[]
}

type FormAction =
  | { type: "SET_PAGE"; page: number }
  | { type: "SET_IGN"; ign: string }
  | { type: "SET_TIMEZONE"; timezone: string }
  | { type: "SET_YES_NO"; questionId: string; value: boolean }
  | { type: "SET_DROPDOWN"; questionId: string; value: string }
  | { type: "SET_TEXT"; questionId: string; value: string }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_SUBMITTED"; value: boolean }
  | { type: "SET_ERRORS"; errors: string[] }
  | { type: "RESET" }

const initialState: FormState = {
  currentPage: 1,
  minecraftIGN: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  yesNoAnswers: {},
  dropdownAnswers: {},
  textAnswers: {},
  isSubmitting: false,
  submitted: false,
  validationErrors: [],
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_PAGE":
      return { ...state, currentPage: action.page, validationErrors: [] }
    case "SET_IGN":
      return { ...state, minecraftIGN: action.ign }
    case "SET_TIMEZONE":
      return { ...state, timezone: action.timezone }
    case "SET_YES_NO":
      return {
        ...state,
        yesNoAnswers: { ...state.yesNoAnswers, [action.questionId]: action.value },
      }
    case "SET_DROPDOWN":
      return {
        ...state,
        dropdownAnswers: { ...state.dropdownAnswers, [action.questionId]: action.value },
      }
    case "SET_TEXT":
      return {
        ...state,
        textAnswers: { ...state.textAnswers, [action.questionId]: action.value },
      }
    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.value }
    case "SET_SUBMITTED":
      return { ...state, submitted: action.value }
    case "SET_ERRORS":
      return { ...state, validationErrors: action.errors }
    case "RESET":
      return initialState
    default:
      return state
  }
}

interface FormContextValue {
  state: FormState
  dispatch: React.Dispatch<FormAction>
  validate: () => boolean
  isFormComplete: boolean
}

const FormContext = createContext<FormContextValue | null>(null)

export function FormProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    formReducer,
    initialState,
    () => {
      try {
        const saved = sessionStorage.getItem("outcraft-form")
        if (saved) {
          const parsed = JSON.parse(saved)
          return {
            ...initialState,
            ...parsed,
            currentPage: parsed.currentPage || 1,
            isSubmitting: false,
            submitted: false,
            validationErrors: [],
          } as FormState
        }
      } catch {
        /* ignore */
      }
      return initialState
    }
  )

  useEffect(() => {
    try {
      sessionStorage.setItem("outcraft-form", JSON.stringify(state))
    } catch {
      // Ignore storage errors (e.g. Opera GX private mode / tracker blocking)
    }
  }, [state])

  const validate = useCallback((): boolean => {
    const errors: string[] = []

    if (!state.minecraftIGN.trim() || state.minecraftIGN.trim().length < 3) {
      errors.push("Minecraft username must be at least 3 characters.")
    }

    if (!state.minecraftIGN.match(/^[a-zA-Z0-9_]+$/)) {
      errors.push("Minecraft username can only contain letters, numbers, and underscores.")
    }

    for (const q of yesNoQuestions) {
      if (state.yesNoAnswers[q.id] === null || state.yesNoAnswers[q.id] === undefined) {
        errors.push(`Please answer: "${q.text}"`)
      }
    }

    const requiredYesIds = ["q3", "q4"]
    for (const id of requiredYesIds) {
      if (state.yesNoAnswers[id] !== true) {
        errors.push("You must answer Yes to all acknowledgment questions.")
      }
    }

    for (const q of dropdownQuestions) {
      if (!state.dropdownAnswers[q.id]) {
        errors.push(`Please select an option for: "${q.text}"`)
      }
    }

    for (const q of textQuestions) {
      if (!state.textAnswers[q.id]?.trim()) {
        errors.push(`Please fill in: "${q.text}"`)
      }
    }

    dispatch({ type: "SET_ERRORS", errors })
    return errors.length === 0
  }, [state])

  const isFormComplete = useMemo(() => {
    if (!state.minecraftIGN.trim() || state.minecraftIGN.trim().length < 3) return false
    if (!state.minecraftIGN.match(/^[a-zA-Z0-9_]+$/)) return false

    for (const q of yesNoQuestions) {
      if (state.yesNoAnswers[q.id] === null || state.yesNoAnswers[q.id] === undefined) return false
    }

    for (const q of dropdownQuestions) {
      if (!state.dropdownAnswers[q.id]) return false
    }

    for (const q of textQuestions) {
      if (!state.textAnswers[q.id]?.trim()) return false
    }

    return true
  }, [state.minecraftIGN, state.yesNoAnswers, state.dropdownAnswers, state.textAnswers])

  return (
    <FormContext.Provider value={{ state, dispatch, validate, isFormComplete }}>
      {children}
    </FormContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useForm() {
  const ctx = useContext(FormContext)
  if (!ctx) throw new Error("useForm must be used within FormProvider")
  return ctx
}
