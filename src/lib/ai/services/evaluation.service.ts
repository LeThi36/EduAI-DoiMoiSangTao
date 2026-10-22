import { GeminiProvider } from '../providers/gemini.provider'
import { AIEvaluationResult, EvaluationRequest } from '../types'
import { AISettingsService } from './ai-settings.service'

const geminiProvider = new GeminiProvider()

export const EvaluationService = {
  async evaluate(request: EvaluationRequest, teacherId?: string): Promise<AIEvaluationResult> {
    const teacherSettings = await AISettingsService.getSettings(teacherId)

    // Kết hợp tiêu chí bài tập với cấu hình quan điểm sư phạm của giáo viên từ Database
    const combinedPrompt = [
      teacherSettings.customPrompt ? `[Định hướng sư phạm chung của giáo viên]:\n${teacherSettings.customPrompt}` : '',
      request.customTeacherPrompt ? `[Yêu cầu chấm riêng cho bài tập này]:\n${request.customTeacherPrompt}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const blendedRequest: EvaluationRequest = {
      ...request,
      feedbackStyle: request.feedbackStyle || teacherSettings.feedbackStyle,
      feedbackDetail: request.feedbackDetail || teacherSettings.feedbackDetail,
      customTeacherPrompt: combinedPrompt,
    }

    return await geminiProvider.evaluateSubmission(blendedRequest)
  },
}
