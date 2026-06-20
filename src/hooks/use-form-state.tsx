import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from "react"

export type YesNoAnswers = Record<string, boolean | null>
export type DropdownAnswers = Record<string, string | undefined>
export type TextAnswers = Record<string, string>

interface FormState {
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
    sessionStorage.setItem("outcraft-form", JSON.stringify(state))
  }, [state])

  const validate = useCallback((): boolean => {
    const errors: string[] = []

    if (!state.minecraftIGN.trim() || state.minecraftIGN.trim().length < 3) {
      errors.push("Minecraft username must be at least 3 characters.")
    }

    if (!state.minecraftIGN.match(/^[a-zA-Z0-9_]+$/)) {
      errors.push("Minecraft username can only contain letters, numbers, and underscores.")
    }

    const requiredYesIds = ["q3", "q4"]
    for (const id of requiredYesIds) {
      if (state.yesNoAnswers[id] !== true) {
        errors.push("You must answer Yes to all acknowledgment questions.")
        break
      }
    }

    dispatch({ type: "SET_ERRORS", errors })
    return errors.length === 0
  }, [state.minecraftIGN, state.yesNoAnswers])

  return (
    <FormContext.Provider value={{ state, dispatch, validate }}>
      {children}
    </FormContext.Provider>
  )
}

export function useForm() {
  const ctx = useContext(FormContext)
  if (!ctx) throw new Error("useForm must be used within FormProvider")
  return ctx
}
