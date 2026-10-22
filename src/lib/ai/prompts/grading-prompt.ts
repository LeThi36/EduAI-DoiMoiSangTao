import { EvaluationRequest } from '../types'

export function buildGradingPrompt(request: EvaluationRequest): string {
  const rawCriteria = request.rubric?.criteria ?? (Array.isArray(request.rubric as any) ? (request.rubric as any) : null)
  const criteria = Array.isArray(rawCriteria) && rawCriteria.length > 0
    ? rawCriteria
    : [{ name: 'Kỹ năng thực hành và mức độ hoàn thành', maxScore: 10, description: 'Đạt yêu cầu bài tập Tin học' }]

  const criteriaText = criteria
    .map((c: any, i: number) => `${i + 1}. Tiêu chí: "${c.name || 'Tiêu chí'}" - Điểm tối đa: ${c.maxScore ?? 10} điểm\n   Mô tả: ${c.description || ''}`)
    .join('\n')

  return `
Hãy đóng vai một giáo viên Tiểu học ân cần, đánh giá bài nộp của học sinh lớp ${request.gradeLevel} cho đề bài: "${request.assignmentTitle}".

# TIÊU CHÍ CHẤM ĐIỂM (RUBRIC):
${criteriaText}

# PHONG CÁCH NHẬN XÉT:
- Phong cách: ${request.feedbackStyle || 'encouraging'} (khích lệ, tích cực, dùng ngôn từ dễ hiểu với học sinh Tiểu học).
- Mức độ chi tiết: ${request.feedbackDetail || 'standard'}
${request.customTeacherPrompt ? `\n# HƯỚNG DẪN BỔ SUNG TỪ GIÁO VIÊN:\n${request.customTeacherPrompt}` : ''}

# NỘI DUNG BÀI LÀM CỦA HỌC SINH:
---
${request.submissionContent || '(Học sinh nộp file đính kèm)'}
${request.fileMetadata ? `\n[Tệp tin đính kèm]: ${request.fileMetadata.name} (${request.fileMetadata.type})\n[Nội dung trích xuất]: ${request.fileMetadata.extractedText || 'Không có văn bản trích xuất'}` : ''}
---

# YÊU CẦU ĐẦU RA JSON:
Trả về duy nhất một chuỗi JSON hợp lệ không có markdown backticks xung quanh:
{
  "totalScore": number,
  "strengths": string | null, // Viết 1-2 câu trọn vẹn khen ngợi cụ thể. KHÔNG CHÉP LẠI ĐỀ BÀI. Trả về null nếu học sinh làm sai toàn bộ (0 điểm) hoặc không có điểm nào tốt để khen.
  "weaknesses": string | null, // Viết 1-2 câu trọn vẹn chỉ ra lỗi sai nhẹ nhàng. KHÔNG CHÉP LẠI ĐỀ BÀI. Trả về null nếu bài làm trọn vẹn, điểm tối đa không có lỗi.
  "suggestions": string | null, // Lời khuyên ân cần để làm tốt hơn. Có thể để null nếu không cần thiết.
  "criterionScores": [
    {
      "criterionName": "Tên tiêu chí",
      "maxScore": number,
      "suggestedScore": number,
      "evidence": "Căn cứ bài làm...",
      "feedback": "Nhận xét chi tiết cho tiêu chí này (viết thành câu hoàn chỉnh)..."
    }
  ]
}
`
}
