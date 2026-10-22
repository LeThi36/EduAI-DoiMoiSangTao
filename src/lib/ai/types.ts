export interface AICriterionResult {
  criterionName: string
  maxScore: number
  suggestedScore: number
  evidence: string
  feedback: string
}

export interface AIEvaluationResult {
  totalScore: number
  maxScore: number
  strengths: string | null
  weaknesses: string | null
  suggestions: string | null
  criterionScores: AICriterionResult[]
  confidenceScore?: number
  flags?: string[] // e.g. "manual_review_needed", "unsupported_file"
  processingTimeMs?: number
}

export interface RubricCriterion {
  name: string
  maxScore: number
  description: string
}

export interface Rubric {
  criteria: RubricCriterion[]
}

export interface EvaluationRequest {
  assignmentTitle: string
  gradeLevel: number
  submissionContent?: string
  fileMetadata?: {
    name: string
    type: string
    size: number
    extractedText?: string
  }
  rubric: Rubric
  customTeacherPrompt?: string
  feedbackStyle?: 'encouraging' | 'concise' | 'detailed'
  feedbackDetail?: 'short' | 'standard' | 'detailed'
}

export interface AISettingsConfig {
  provider: string
  model: string
  isConnected: boolean
  feedbackLanguage: string
  feedbackStyle: 'encouraging' | 'concise' | 'detailed'
  feedbackDetail: 'short' | 'standard' | 'detailed'
  customPrompt: string
  updatedAt: string
}
