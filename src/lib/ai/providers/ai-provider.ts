import { AIEvaluationResult, EvaluationRequest } from '../types'

export interface IAIProvider {
  name: string
  isAvailable(): boolean
  evaluateSubmission(request: EvaluationRequest): Promise<AIEvaluationResult>
}
