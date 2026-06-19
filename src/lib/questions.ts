export type QuestionType = "yesno" | "dropdown" | "text" | "longtext"

export interface YesNoQuestion {
  id: string
  type: "yesno"
  text: string
  order: number
}

export interface DropdownQuestion {
  id: string
  type: "dropdown"
  text: string
  order: number
  options: string[]
  placeholder?: string
}

export interface TextQuestion {
  id: string
  type: "text" | "longtext"
  text: string
  order: number
  maxLength?: number
  placeholder?: string
}

export type Question = YesNoQuestion | DropdownQuestion | TextQuestion

export const yesNoQuestions: YesNoQuestion[] = [
  {
    id: "q1",
    type: "yesno",
    text: "Have you participated in any OutCraft events before?",
    order: 1,
  },
  {
    id: "q2",
    type: "yesno",
    text: "Are you available on the event dates (to be announced)?",
    order: 2,
  },
  {
    id: "q3",
    type: "yesno",
    text: "Do you have a working microphone and are willing to use voice chat?",
    order: 3,
  },
  {
    id: "q4",
    type: "yesno",
    text: "Do you agree to follow the OutCraft server rules?",
    order: 4,
  },
]

export const dropdownQuestions: DropdownQuestion[] = [
  {
    id: "d1",
    type: "dropdown",
    text: "Which content style would you most likely participate in?",
    order: 1,
    placeholder: "Select an option...",
    options: [
      "Pure survival building and exploration",
      "Redstone and technical Minecraft",
      "PvP, minigames and competitive events",
      "Streaming/recording content creation",
    ],
  },
]

export const textQuestions: TextQuestion[] = [
  {
    id: "t1",
    type: "longtext",
    text: "Tell us a bit about yourself and why you want to join OutCraft.",
    order: 1,
    maxLength: 1000,
    placeholder: "Share your story, what you enjoy about Minecraft, and what you'd bring to the community...",
  },
  {
    id: "t2",
    type: "longtext",
    text: "What kind of content or gameplay do you enjoy most in Minecraft?",
    order: 2,
    maxLength: 500,
    placeholder: "e.g. building, redstone, PvP, exploration, minigames...",
  },
]
