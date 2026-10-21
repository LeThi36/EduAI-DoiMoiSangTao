import { AI_CONFIG } from '../config/env'
import type { QuizItemResult, QuizResult } from '@/lib/data-store'

interface QuizFeedbackInput {
  assignmentTitle: string
  gradeLevel: number
  studentName: string
  items: QuizItemResult[]
  score: number
  maxScore: number
  /** previous quiz results of the same student, for trend context */
  history?: { title: string; score: number; maxScore: number }[]
}

type AIFeedback = Pick<QuizResult, 'studentFeedback' | 'teacherInsight'> & {
  explanations: { questionId: string; explanation: string; hint: string }[]
}

const SYSTEM_PROMPT = `Bạn là trợ lý giáo viên Tin học tiểu học tại Việt Nam.
Nhiệm vụ: phân tích bài trắc nghiệm ĐÃ ĐƯỢC CHẤM theo đáp án của giáo viên (không chấm lại điểm).
- Với mỗi câu SAI: giải thích ngắn gọn, dễ hiểu cho học sinh tiểu học vì sao đáp án em chọn chưa đúng và vì sao đáp án đúng là đúng; kèm một gợi ý ghi nhớ.
- Viết nhận xét chung cho học sinh: xưng "em", giọng khích lệ, 2-4 câu.
- Viết phân tích cho giáo viên: khách quan, chỉ ra kiến thức đã nắm, kiến thức còn yếu, quan niệm sai (nếu có) và đề xuất hướng hỗ trợ cụ thể.
Chỉ trả về JSON hợp lệ đúng schema được yêu cầu, bằng tiếng Việt.`

function buildPrompt(input: QuizFeedbackInput): string {
  const lines = input.items.map((it) =>
    [
      `- questionId: ${it.questionId}`,
      `  Câu ${it.index}: ${it.content}`,
      `  Học sinh chọn: ${it.selectedLabel}. ${it.selectedText ?? ''}`,
      `  Đáp án đúng: ${it.correctLabel}. ${it.correctText ?? ''}`,
      `  Kết quả: ${it.isCorrect ? 'ĐÚNG' : 'SAI'}`,
    ].join('\n')
  )
  const history =
    input.history && input.history.length
      ? `\nCác bài trắc nghiệm trước của học sinh:\n${input.history
          .map((h) => `- ${h.title}: ${h.score}/${h.maxScore}`)
          .join('\n')}`
      : ''

  return `Bài: "${input.assignmentTitle}" — Khối ${input.gradeLevel}
Học sinh: ${input.studentName}
Điểm: ${input.score}/${input.maxScore} (${input.items.filter((i) => i.isCorrect).length}/${input.items.length} câu đúng)
${history}

Chi tiết từng câu:
${lines.join('\n')}

Trả về JSON:
{
  "explanations": [{ "questionId": string, "explanation": string, "hint": string }],  // CHỈ cho các câu SAI
  "studentFeedback": string,
  "teacherInsight": {
    "summary": string,
    "masteredConcepts": string[],
    "weakConcepts": string[],
    "misconceptions": string[],
    "recommendation": string
  }
}`
}

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

async function callGemini(input: QuizFeedbackInput): Promise<AIFeedback | null> {
  if (!AI_CONFIG.gemini.apiKey) return null
  const candidateModels = [
    AI_CONFIG.gemini.model,
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i)

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${AI_CONFIG.gemini.apiKey}`
      console.log(`[QuizFeedbackService] Calling Gemini API (${model}) for quiz feedback...`)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        if (res.status === 404 && model !== candidateModels[candidateModels.length - 1]) {
          console.warn(`[QuizFeedbackService] Model ${model} returned 404, trying next candidate...`)
          continue
        }
        console.error(`[QuizFeedbackService] Gemini API returned error ${res.status}:`, errText)
        return null
      }
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) continue
      const cleaned = cleanJsonString(text)
      const parsed = JSON.parse(cleaned) as AIFeedback
      if (!parsed.studentFeedback || !parsed.teacherInsight) continue
      console.log(`[QuizFeedbackService] Generated live AI quiz feedback successfully with (${model})`)
      return parsed
    } catch (err) {
      console.warn(`[QuizFeedbackService] Quiz feedback AI failed on model ${model}:`, err)
      continue
    }
  }
  return null
}

function fallback(input: QuizFeedbackInput): AIFeedback {
  const wrong = input.items.filter((i) => !i.isCorrect)
  const right = input.items.filter((i) => i.isCorrect)
  const ratio = input.items.length ? right.length / input.items.length : 0
  const short = (s: string) => (s.length > 60 ? s.slice(0, 57) + '...' : s)

  return {
    explanations: wrong.map((i) => ({
      questionId: i.questionId,
      explanation: `Em chọn "${i.selectedLabel}. ${i.selectedText ?? ''}" nhưng đáp án đúng là "${i.correctLabel}. ${i.correctText ?? ''}". Em hãy đọc kỹ lại câu hỏi và so sánh hai đáp án này nhé.`,
      hint: 'Đọc kỹ từ khoá trong câu hỏi và loại trừ các đáp án chắc chắn sai trước.',
    })),
    studentFeedback:
      ratio === 1
        ? 'Tuyệt vời! Em đã trả lời đúng tất cả các câu. Hãy tiếp tục phát huy nhé!'
        : ratio >= 0.7
        ? `Em làm khá tốt, đúng ${right.length}/${input.items.length} câu. Em xem lại các câu sai và lời giải thích bên dưới để hiểu bài hơn nhé.`
        : `Em đúng ${right.length}/${input.items.length} câu. Đừng nản nhé! Em hãy đọc kỹ phần giải thích các câu sai và ôn lại bài cùng thầy cô.`,
    teacherInsight: {
      summary: `${input.studentName} đạt ${input.score}/${input.maxScore}, đúng ${right.length}/${input.items.length} câu.`,
      masteredConcepts: right.map((i) => `Câu ${i.index}: ${short(i.content)}`),
      weakConcepts: wrong.map((i) => `Câu ${i.index}: ${short(i.content)}`),
      misconceptions: wrong.map(
        (i) => `Câu ${i.index}: nhầm "${i.selectedText ?? i.selectedLabel}" với "${i.correctText ?? i.correctLabel}"`
      ),
      recommendation:
        wrong.length === 0
          ? 'Có thể giao thêm bài nâng cao cho học sinh.'
          : 'Ôn lại các nội dung ở những câu sai, hỏi học sinh giải thích lựa chọn để phát hiện hiểu lầm.',
    },
  }
}

export const QuizFeedbackService = {
  async analyze(input: QuizFeedbackInput): Promise<Pick<QuizResult, 'items' | 'studentFeedback' | 'teacherInsight' | 'aiGenerated'>> {
    const ai = await callGemini(input)
    const fb = ai ?? fallback(input)
    const byId = new Map(fb.explanations?.map((e) => [e.questionId, e]) ?? [])
    const fbMap = ai ? new Map(fallback(input).explanations.map((e) => [e.questionId, e])) : byId

    const items = input.items.map((it) => {
      if (it.isCorrect) return it
      const e = byId.get(it.questionId) ?? fbMap.get(it.questionId)
      return { ...it, explanation: e?.explanation, hint: e?.hint }
    })

    return {
      items,
      studentFeedback: fb.studentFeedback,
      teacherInsight: {
        summary: fb.teacherInsight.summary || '',
        masteredConcepts: fb.teacherInsight.masteredConcepts || [],
        weakConcepts: fb.teacherInsight.weakConcepts || [],
        misconceptions: fb.teacherInsight.misconceptions || [],
        recommendation: fb.teacherInsight.recommendation || '',
      },
      aiGenerated: Boolean(ai),
    }
  },
}
