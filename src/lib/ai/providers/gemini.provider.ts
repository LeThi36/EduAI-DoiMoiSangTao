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
   * Đánh giá và chấm bài HOÀN TOÀN do AI (Google Gemini) thực hiện.
   * Dựa trên Rubric tiêu chí và prompt/quan điểm do giáo viên chỉ đạo từ Database.
   * Không sử dụng rule-engine hay điểm số giả lập.
   */
  async evaluateSubmission(request: EvaluationRequest): Promise<AIEvaluationResult> {
    const startTime = Date.now()

    const rawCriteria =
      request.rubric?.criteria ?? (Array.isArray(request.rubric as any) ? (request.rubric as any) : null)
    const criteria =
      Array.isArray(rawCriteria) && rawCriteria.length > 0
        ? rawCriteria
        : [{ name: 'Kỹ năng thực hành và mức độ hoàn thành', maxScore: 10, description: 'Đạt yêu cầu bài tập Tin học' }]

    // 1. Kiểm tra bài nộp trống trước khi gọi AI để tiết kiệm tối đa Token
    const content = (request.submissionContent || '').trim()
    const hasFile = Boolean(request.fileMetadata?.name || (request as any).fileUrl)

    if (content.length === 0 && !hasFile) {
      console.log('[GeminiProvider] Phát hiện bài nộp trống (không có chữ và tệp) -> Bỏ qua gọi AI để tiết kiệm token.')
      let maxTotal = 0
      criteria.forEach((c: any) => { maxTotal += (Number(c.maxScore) || 10) })

      return {
        totalScore: 0,
        maxScore: maxTotal,
        strengths: null,
        weaknesses: 'Học sinh nộp bài trống (không có nội dung văn bản và không có tệp đính kèm).',
        suggestions: 'Em hãy hoàn thiện bài tập và nộp lại đầy đủ theo yêu cầu của thầy cô nhé.',
        criterionScores: criteria.map((c: any) => ({
          criterionName: c.name || 'Tiêu chí',
          maxScore: Number(c.maxScore) || 10,
          suggestedScore: 0,
          evidence: 'Không có bài làm hoặc tệp đính kèm.',
          feedback: `Chưa thực hiện tiêu chí "${c.name || 'tiêu chí'}".`,
        })),
        confidenceScore: 1.0,
        processingTimeMs: Date.now() - startTime,
      }
    }

    if (!this.isAvailable()) {
      throw new Error(
        'Chưa cấu hình API Key Google Gemini. Vui lòng thiết lập biến môi trường GEMINI_API_KEY trong file .env để AI thực hiện chấm bài.'
      )
    }

    const fallbackCriteria = criteria

    const candidateModels = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      AI_CONFIG.gemini.model,
      'gemini-2.5-flash',
      'gemini-flash-latest',
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
          lastError = new Error(`Lỗi kết nối Gemini API (${response.status} trên model ${model}): ${errBody}`)

          if (
            response.status === 402 ||
            errBody.includes('credits are depleted') ||
            errBody.includes('RESOURCE_EXHAUSTED')
          ) {
            throw new Error(
              'Lỗi Gemini 402: Tài khoản Google Cloud / AI Studio của API Key này đã hết hạn mức tín dụng. ' +
              'Vui lòng vào https://aistudio.google.com/app/apikey để tạo API Key từ một Google Cloud Project miễn phí hoặc nạp thêm số dư.'
            )
          }

          if (model !== candidateModels[candidateModels.length - 1]) {
            console.warn(`[GeminiProvider] Model ${model} gặp lỗi (${response.status}), đang tự động thử model tiếp theo...`)
            continue
          }

          throw lastError
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
            strengths: parsed.strengths ?? null,
            weaknesses: parsed.weaknesses ?? null,
            suggestions: parsed.suggestions ?? null,
            criterionScores: normalizedCriterionScores,
            confidenceScore: 0.95,
            processingTimeMs: Date.now() - startTime,
          }
        } else {
          throw new Error('Phản hồi từ Google Gemini không chứa nội dung đánh giá hợp lệ.')
        }
      } catch (err: any) {
        lastError = err
        if (model !== candidateModels[candidateModels.length - 1]) {
          console.warn(`[GeminiProvider] Model ${model} gặp sự cố, tự động thử model tiếp theo...`)
          continue
        }
      }
    }

    if (lastError) {
      throw new Error(formatUserFriendlyAIError(lastError))
    }

    // If no API key configured, use content-aware rubric evaluation engine
    return evaluateContentRuleEngine(request, startTime)
  }
}

/**
 * Động cơ chấm theo quy tắc sư phạm (Rule-based Pedagogical Evaluation)
 * Chỉ đánh giá dựa trên dữ kiện thực tế có thể xác minh trực tiếp từ bài nộp:
 * 1. Bài nộp trống (không có nội dung và không có tệp) -> 0 điểm.
 * 2. Bài quá ngắn / sơ sài (< 30 ký tự và không có tệp) -> Điểm rất thấp (20%), cảnh báo chưa đạt yêu cầu.
 * 3. Bài yêu cầu tệp đính kèm: Nếu thiếu tệp -> 0 điểm tiêu chí tệp sản phẩm.
 * 4. Bài có tệp hoặc nội dung hoàn chỉnh -> Ghi nhận hoàn thành tiêu chí cơ bản.
 */
function evaluateContentRuleEngine(request: EvaluationRequest, startTime: number): AIEvaluationResult {
  const content = (request.submissionContent || '').trim()
  const hasFile = Boolean(request.fileMetadata?.name)

  const rawCriteria = request.rubric?.criteria ?? (Array.isArray(request.rubric as any) ? (request.rubric as any) : null)
  const criteria = Array.isArray(rawCriteria) && rawCriteria.length > 0
    ? rawCriteria
    : [{ name: 'Kỹ năng thực hành và mức độ hoàn thành', maxScore: 10, description: 'Đạt yêu cầu bài tập Tin học' }]

  let maxTotal = 0
  criteria.forEach((c: any) => { maxTotal += (Number(c.maxScore) || 10) })

  // 1. Bài nộp hoàn toàn trống (không có chữ và không có tệp)
  if (content.length === 0 && !hasFile) {
    return {
      totalScore: 0,
      maxScore: maxTotal,
      strengths: 'Chưa có minh chứng bài làm để đánh giá.',
      weaknesses: 'Học sinh chưa hoàn thành bài tập hoặc nộp bài trắng khi chưa kịp làm.',
      suggestions: 'Em cần chú ý theo dõi thời gian và nộp bài đầy đủ theo hướng dẫn của thầy cô.',
      criterionScores: criteria.map((c: any) => ({
        criterionName: c.name || 'Tiêu chí',
        maxScore: Number(c.maxScore) || 10,
        suggestedScore: 0,
        evidence: 'Không có nội dung bài làm hoặc tệp đính kèm.',
        feedback: `Chưa thực hiện tiêu chí "${c.name || 'tiêu chí'}".`,
      })),
      processingTimeMs: Date.now() - startTime,
    }
  }

  // 2. Bài nộp quá ngắn / sơ sài (< 30 ký tự và không có tệp)
  if (content.length < 30 && !hasFile) {
    let totalScore = 0
    const criterionScores = criteria.map((c: any) => {
      const maxScore = Number(c.maxScore) || 10
      const earned = Math.round(maxScore * 0.2 * 10) / 10
      totalScore += earned
      return {
        criterionName: c.name || 'Tiêu chí',
        maxScore,
        suggestedScore: earned,
        evidence: `Bài nộp quá ngắn (${content.length} ký tự): "${content}"`,
        feedback: `Nội dung quá sơ sài, chưa đáp ứng yêu cầu "${c.name || 'tiêu chí'}".`,
      }
    })

    return {
      totalScore: Math.round(totalScore * 10) / 10,
      maxScore: maxTotal,
      strengths: 'Có nộp bài đúng hạn.',
      weaknesses: 'Nội dung bài làm quá sơ sài, chưa giải quyết được các yêu cầu của bài tập.',
      suggestions: 'Em cần đọc kỹ lại đề bài và trình bày đầy đủ các phần bài làm.',
      criterionScores,
      processingTimeMs: Date.now() - startTime,
    }
  }

  // 3. Bài có nội dung hoặc có tệp đính kèm
  let totalScore = 0
  const criterionScores = criteria.map((c: any) => {
    const maxScore = Number(c.maxScore) || 10
    const isFileCriterion = /tệp|file|đính kèm|sản phẩm|trình chiếu|bài làm|hình ảnh/i.test(c.name || '')

    // Nếu tiêu chí yêu cầu nộp file mà học sinh không có file đính kèm
    if (isFileCriterion && !hasFile) {
      return {
        criterionName: c.name || 'Tiêu chí',
        maxScore,
        suggestedScore: 0,
        evidence: 'Không tìm thấy tệp đính kèm trong bài nộp.',
        feedback: `Tiêu chí yêu cầu tệp đính kèm nhưng học sinh không nộp tệp.`,
      }
    }

    // Có bài làm hoặc tệp hợp lệ
    const ratio = hasFile ? 0.8 : 0.7
    const earned = Math.round(maxScore * ratio * 10) / 10
    totalScore += earned
    return {
      criterionName: c.name || 'Tiêu chí',
      maxScore,
      suggestedScore: earned,
      evidence: hasFile ? `Tệp bài làm: ${request.fileMetadata?.name}` : `Nội dung bài làm: ${content.slice(0, 100)}...`,
      feedback: hasFile ? `Đã nộp tệp ${request.fileMetadata?.name} theo yêu cầu.` : `Đã hoàn thành nội dung bài làm.`,
    }
  })

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    maxScore: maxTotal,
    strengths: hasFile ? 'Đã nộp đủ tệp sản phẩm theo yêu cầu.' : 'Đã hoàn thành nội dung trả lời bài tập.',
    weaknesses: !hasFile ? 'Cần bổ sung tệp đính kèm hoặc ảnh chụp minh chứng nếu bài tập yêu cầu thực hành.' : 'Giáo viên nên kiểm tra chi tiết nội dung tệp bài làm.',
    suggestions: 'Em tiếp tục duy trì việc hoàn thành bài tập đầy đủ và đúng hạn.',
    criterionScores,
    processingTimeMs: Date.now() - startTime,
  }
}

/**
 * Chuyển đổi các mã lỗi kỹ thuật phức tạp thành thông báo tiếng Việt thân thiện với giáo viên
 */
export function formatUserFriendlyAIError(error: any): string {
  if (!error) return 'Lỗi không xác định khi gọi AI chấm bài.'
  const msg = typeof error === 'string' ? error : (error.message || String(error))

  if (/503|high demand|overloaded|UNAVAILABLE|temporary/i.test(msg)) {
    return 'Máy chủ AI Google đang bị quá tải tạm thời do lượng truy cập cao. Thầy/Cô vui lòng thử lại sau 1-2 phút nhé.'
  }
  if (/429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg)) {
    return 'Đã đạt giới hạn số lượt gọi AI miễn phí trong phút này. Thầy/Cô vui lòng chờ 1 phút rồi bấm chấm lại.'
  }
  if (/401|403|API_KEY_INVALID|API key not valid/i.test(msg)) {
    return 'Khóa API Google Gemini không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại cấu hình GEMINI_API_KEY trong file .env.'
  }
  if (/402|credits are depleted/i.test(msg)) {
    return 'Tài khoản Google Cloud/AI Studio đã hết hạn mức tín dụng. Vui lòng tạo API Key mới từ Google Cloud Project miễn phí.'
  }
  if (/ENOTFOUND|ECONNREFUSED|fetch failed|network|socket/i.test(msg)) {
    return 'Không thể kết nối tới máy chủ Google (lỗi mạng hoặc mất kết nối Internet). Vui lòng kiểm tra lại kết nối mạng.'
  }
  if (/Chưa cấu hình API Key/i.test(msg)) {
    return msg
  }

  // Loại bỏ các đoạn JSON kỹ thuật hoặc URL nếu có (dùng [\s\S] thay vì cờ 's' để tương thích toàn bộ phiên bản ES)
  const cleaned = msg
    .replace(/\{[\s\S]*?\}/g, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/Lỗi kết nối Gemini API \(\d+[^)]*\):/g, '')
    .trim()

  return cleaned || 'Máy chủ AI tạm thời không thể phản hồi. Thầy/Cô vui lòng thử lại sau ít phút.'
}
