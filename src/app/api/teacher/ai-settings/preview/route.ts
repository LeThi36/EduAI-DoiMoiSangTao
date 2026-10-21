import { NextRequest, NextResponse } from 'next/server'
import { EvaluationService } from '@/lib/ai/services/evaluation.service'
import { EvaluationRequest } from '@/lib/ai/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Default sample data if not specified
    const evaluationReq: EvaluationRequest = {
      assignmentTitle: body.assignmentTitle || 'Bài tập thực hành: Soạn thảo văn bản Word đơn giản',
      gradeLevel: body.gradeLevel || 3,
      submissionContent: body.submissionContent || 'Em đã gõ xong bài thơ Hạt gạo làng ta, dùng phông chữ Arial cỡ 14 và in đậm tiêu đề bài thơ.',
      rubric: body.rubric || {
        criteria: [
          { name: 'Định dạng phông chữ và cỡ chữ', maxScore: 4, description: 'Đúng cỡ 14, phông chữ Arial rõ ràng' },
          { name: 'Gõ tiếng Việt có dấu đúng chính tả', maxScore: 4, description: 'Không bị gõ sai dấu, khoảng cách hợp lý' },
          { name: 'Trình bày tiêu đề', maxScore: 2, description: 'Tiêu đề in đậm và căn giữa' },
        ],
      },
      customTeacherPrompt: body.customPrompt,
      feedbackStyle: body.feedbackStyle,
      feedbackDetail: body.feedbackDetail,
    }

    const result = await EvaluationService.evaluate(evaluationReq)
    return NextResponse.json({ result })
  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json({ error: 'Lỗi chạy thử nghiệm AI' }, { status: 500 })
  }
}
