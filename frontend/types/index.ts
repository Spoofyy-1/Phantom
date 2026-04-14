export interface Archetype {
  id: string
  name: string
  age: number
  location: string
  occupation: string
  avatar: string
  color: string
  traits: string[]
  short_desc: string
  custom?: boolean
}

export interface PersonaRef {
  id: string
  custom_persona?: Archetype & { system_prompt: string }
}

export interface ConfusionEvent {
  step: number
  url: string
  thought: string
  confusion_note: string
  confusion_score: number
  screenshot: string
  persona_name?: string
}

export interface PersonaResult {
  persona_id: string
  persona_name: string
  persona_avatar: string
  success: boolean
  gave_up: boolean
  steps_taken: number
  reason: string
  confusion_events: ConfusionEvent[]
  total_confusion_score: number
  events: StepEvent[]
  duration_seconds: number
}

export interface StepEvent {
  type: 'step'
  persona_id: string
  persona_name: string
  step: number
  url: string
  thought: string
  action_type: string
  action_target: string | number | null
  confusion: string | null
  confusion_score: number
  screenshot: string
}

export interface TestResults {
  test_id: string
  url: string
  task: string
  personas: PersonaResult[]
  succeeded: number
  total_personas: number
  ux_score: number
  grade: string
  avg_confusion: number
  top_issues: ConfusionEvent[]
  summary: string
  recommendations: string[]
}

export type LiveEvent =
  | { type: 'test_start'; test_id: string; url: string; task: string }
  | { type: 'persona_start'; persona_id: string; persona_name: string }
  | StepEvent
  | { type: 'persona_complete'; persona_id: string; persona_name: string; success: boolean; steps: number; result: PersonaResult }
  | { type: 'ask_user'; persona_id: string; persona_name: string; question: string; screenshot: string }
  | { type: 'persona_error'; persona_id: string; persona_name: string; error: string }
  | { type: 'test_complete'; test_id: string; results: TestResults }
  | { type: 'error'; message: string }

export type TestStatus = 'idle' | 'running' | 'complete' | 'error'
