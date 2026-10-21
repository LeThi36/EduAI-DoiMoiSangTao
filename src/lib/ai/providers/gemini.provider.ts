import { IAIProvider } from './ai-provider'
import { AIEvaluationResult, EvaluationRequest } from '../types'
import { AI_CONFIG } from '../config/env'
import { BASE_SYSTEM_PROMPT } from '../prompts/system-prompt'
import { buildGradingPrompt } from '../prompts/grading-prompt'

function cleanJsonString(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  return cleaned.trim()
}

export class GeminiProvider implements IAIProvider {
  name = 'gemini'

  isAvailable(): boolean {
    return Boolean(AI_CONFIG.gemini.apiKey)
  }

  /**
   * Đánh giá và chấm bài:
   * 1. Pre-check bằng code: Nếu học sinh nộp bài trắng (không có nội dung và không có tệp đính kèm)
   *    -> Trả về 0 điểm ngay lập tức, tiết kiệm 100% token AI và giảm độ trễ mạng.
   * 2. Nếu có bài làm thực tế -> Gọi trực tiếp Google Gemini AI để chấm theo đúng Rubric và Prompt của giáo viên.
   */
  async evaluateSubmission(request: EvaluationRequest): Promise<AIEvaluationResult> {
    const startTime = Date.now()

    const rawCriteria =
      request.rubric?.criteria ?? (Array.isArray(request.rubric as any) ? (request.rubric as any) : null)
    const fallbackCriteria =
      Array.isArray(rawCriteria) && rawCriteria.length > 0
        ? rawCriteria
        : [{ name: 'Kỹ năng thực hành và mức độ hoàn thành', maxScore: 10, description: 'Đạt yêu cầu bài tập Tin học' }]

    const content = (request.submissionContent || '').trim()
    const hasFile = Boolean(request.fileMetadata?.name || (request as any).fileUrl)

    const isPlaceholder =
      content === '(Hết giờ làm bài - hệ thống tự động nộp bài làm hiện tại)' ||
      content === '(Học sinh nộp file đính kèm)' ||
      content === '(Học sinh không để lại lời nhắn kèm theo)' ||
      content === '(Hết giờ - chưa kịp nhập câu trả lời)'

    const isActualEmpty = (content.length === 0 || isPlaceholder) && !hasFile

    // =========================================================================
    // 1. KIỂM TRA NHANH BẰNG CODE (FAST PRE-CHECK ĐỂ TIẾT KIỆM TOKEN):
    // Nếu học sinh nộp bài hoàn toàn trống (không có nội dung chữ và không có tệp)
    // -> Không cần tốn token gọi Gemini, code trả về ngay kết quả 0 điểm.
    // =========================================================================
    if (isActualEmpty) {
      console.log(`[GeminiProvider] Phát hiện bài nộp trống hoặc hết giờ chưa làm cho "${request.assignmentTitle}". Bỏ qua gọi AI để tiết kiệm token.`)
      const maxTotal = fallbackCriteria.reduce((sum: number, c: any) => sum + (Number(c.maxScore) || 10), 0)

      return {
        totalScore: 0,
        maxScore: maxTotal,
        strengths: 'Chưa có minh chứng bài làm để ghi nhận.',
        weaknesses: 'Học sinh chưa hoàn thành bài tập hoặc hết thời gian làm bài mà chưa nộp nội dung/tệp sản phẩm.',
        suggestions: 'Em cần chú ý theo dõi thời gian và nộp bài đầy đủ theo hướng dẫn của thầy cô.',
        criterionScores: fallbackCriteria.map((c: any) => ({
          criterionName: c.name || 'Tiêu chí',
          maxScore: Number(c.maxScore) || 10,
          suggestedScore: 0,
          evidence: 'Không có nội dung bài làm hoặc tệp đính kèm.',
          feedback: `Chưa thực hiện tiêu chí "${c.name || 'tiêu chí'}".`,
        })),
        confidenceScore: 1.0,
        processingTimeMs: Date.now() - startTime,
      }
    }

    // =========================================================================
    // 2. NẾU HỌC SINH CÓ LÀM BÀI -> GỬI SANG GOOGLE GEMINI AI ĐỂ CHẤM ĐIỂM
    // =========================================================================
    if (!this.isAvailable()) {
      throw new Error(
        'Chưa cấu hình API Key Google Gemini. Vui lòng thiết lập biến môi trường GEMINI_API_KEY trong file .env để AI thực hiện chấm bài.'
      )
    }

    const candidateModels = [
      AI_CONFIG.gemini.model,
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash',
    ].filter((m, i, arr) => m && arr.indexOf(m) === i)

    let lastError: any = null

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${AI_CONFIG.gemini.apiKey}`
        const prompt = buildGradingPrompt(request)

        console.log(`[GeminiProvider] Đang gửi bài tập sang Google Gemini (${model}) để AI chấm...`)

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: BASE_SYSTEM_PROMPT }],
            },
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        })

        if (!response.ok) {
          const errBody = await response.text()
          if (response.status === 404 && model !== candidateModels[candidateModels.length - 1]) {
            console.warn(`[GeminiProvider] Model ${model} trả về 404, thử model tiếp theo...`)
            lastError = new Error(`Gemini API error 404 on ${model}: ${errBody}`)
            continue
          }

          if (
            response.status === 402 ||
            errBody.includes('credits are depleted') ||
            errBody.includes('RESOURCE_EXHAUSTED')
          ) {
            throw new Error(
              'Lỗi Gemini 402: Tài khoản Google Cloud / AI Studio của API Key này đã hết hạn mức tín dụng trả trước. ' +
                'Vui lòng vào https://aistudio.google.com/app/apikey để tạo API Key từ một Google Cloud Project miễn phí hoặc nạp thêm số dư.'
            )
          }

          throw new Error(`Lỗi kết nối Gemini API (${response.status}): ${errBody}`)
        }

        const data = await response.json()
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (textResponse) {
          const cleaned = cleanJsonString(textResponse)
          const parsed = JSON.parse(cleaned)
          console.log(
            `[GeminiProvider] AI Gemini (${model}) đã chấm xong bài thành công trong ${Date.now() - startTime}ms`
          )

          const rawScores = Array.isArray(parsed.criterionScores)
            ? parsed.criterionScores
            : Array.isArray(parsed.criteriaScores)
              ? parsed.criteriaScores
              : Array.isArray(parsed.criteria)
                ? parsed.criteria
                : []

          const normalizedCriterionScores =
            rawScores.length > 0
              ? rawScores.map((c: any) => ({
                  criterionName: c.criterionName || c.criterion || c.name || 'Tiêu chí',
                  maxScore: Number(c.maxScore) || 10,
                  suggestedScore: Number(c.suggestedScore ?? c.score ?? 0),
                  evidence: c.evidence || c.feedback || '',
                  feedback: c.feedback || '',
                }))
              : fallbackCriteria.map((c: any) => ({
                  criterionName: c.name || 'Tiêu chí',
                  maxScore: Number(c.maxScore) || 10,
                  suggestedScore: Number(parsed.totalScore) || 8,
                  evidence: parsed.strengths || 'Học sinh hoàn thành bài làm.',
                  feedback: parsed.suggestions || '',
                }))

          return {
            ...parsed,
            criterionScores: normalizedCriterionScores,
            confidenceScore: 0.95,
            processingTimeMs: Date.now() - startTime,
          }
        } else {
          throw new Error('Phản hồi từ Google Gemini không chứa nội dung đánh giá hợp lệ.')
        }
      } catch (err: any) {
        lastError = err
        if (err?.message?.includes('404') && model !== candidateModels[candidateModels.length - 1]) {
          continue
        }
        throw err
      }
    }

    if (lastError) {
      throw lastError
    }

    throw new Error('Không thể kết nối với mô hình AI Gemini.')
  }
}
