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
    text: "Do you have a working microphone?",
    order: 1,
  },
  {
    id: "q2",
    type: "yesno",
    text: "Do you have a clipping software?",
    order: 2,
  },
]

export const dropdownQuestions: DropdownQuestion[] = [
  {
    id: "d1",
    type: "dropdown",
    text: "What layer would you like to be apart of?",
    order: 1,
    placeholder: "Select a layer...",
    options: [
      "Glacier",
      "Lush",
      "Ember",
      "Random",
    ],
  },
]

export const textQuestions: TextQuestion[] = [
  {
    id: "t1",
    type: "text",
    text: "Are you applying alone or with other people?",
    order: 1,
    maxLength: 200,
    placeholder: "e.g. alone, with 2 friends, with a group of 5...",
  },
  {
    id: "t2",
    type: "longtext",
    text: "What civilization events have you played in the past, what role did you play in them and what did you get up to?",
    order: 2,
    maxLength: 1000,
    placeholder: "Describe your past civilization event experience, your role, and what you did...",
  },
  {
    id: "t3",
    type: "longtext",
    text: "What type of characters do you want to play, what will they get up to?",
    order: 3,
    maxLength: 1000,
    placeholder: "Describe the character(s) you want to roleplay and their activities...",
  },
  {
    id: "t4",
    type: "longtext",
    text: "What are your goals for this event and for your character? What's your lore? How could you relate this with the underground theme?",
    order: 4,
    maxLength: 1500,
    placeholder: "Share your goals, character lore, and how you connect with the underground theme...",
  },
  {
    id: "t5",
    type: "longtext",
    text: "What are your strongest Minecraft skills? Explain how you would use them.",
    order: 5,
    maxLength: 1000,
    placeholder: "e.g. Building, PvP, Redstone, Farming, Resource gathering, Diplomacy, Strategy — explain how you'd use them...",
  },
  {
    id: "t6",
    type: "longtext",
    text: "If you were tasked to make a build for your nation, what would the build theme be? What would the building type be? A castle, a tower, a hotel...",
    order: 6,
    maxLength: 1000,
    placeholder: "Describe your ideal build theme and type for your nation...",
  },
  {
    id: "t7",
    type: "longtext",
    text: "What's your ideal biome to live in or make a kingdom from? It can be a vanilla biome or a custom one.",
    order: 7,
    maxLength: 500,
    placeholder: "e.g. a dark forest, a mushroom island, a custom underground cavern...",
  },
  {
    id: "t10",
    type: "longtext",
    text: "If you lead a kingdom, what would you value the most: power, membership, builds, reputation?",
    order: 8,
    maxLength: 500,
    placeholder: "Choose one and explain why it matters most to you...",
  },
  {
    id: "t11",
    type: "longtext",
    text: "If you led a team, what would you want your team's reputation to be vs what it would actually end up being?",
    order: 9,
    maxLength: 500,
    placeholder: "Describe the ideal vs realistic reputation of your team...",
  },
  {
    id: "t12",
    type: "longtext",
    text: "Your civilization team has been defeated. What legacy will your character leave behind?",
    order: 10,
    maxLength: 500,
    placeholder: "Describe the legacy your character would leave after defeat...",
  },
  {
    id: "t13",
    type: "longtext",
    text: "Will you be able to play the full event? If there are days you couldn't attend, what days would they be?",
    order: 11,
    maxLength: 500,
    placeholder: "Let us know your availability and any days you cannot attend...",
  },
]
