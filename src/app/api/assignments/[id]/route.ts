import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cloudinaryService } from '@/lib/cloudinary/cloudinary.service'

function validateAssignment(body: Record<string, unknown>) {
  const { title, type, gradeLevel, questions } = body
  if (!title || !type || !gradeLevel) return 'Tiêu đề, thể loại và khối lớp là bắt buộc'
  if (!['multiple_choice', 'essay', 'practice'].includes(String(type))) return 'Hình thức bài tập không hợp lệ'

  const assignmentQuestions = Array.isArray(questions) ? questions : []
  if (
    type === 'multiple_choice' &&
    assignmentQuestions.some(
      (question: any) =>
        !question.content?.trim() ||
        !Array.isArray(question.options) ||
        question.options.length < 2 ||
        question.options.some((option: { text?: string }) => !option.text?.trim()) ||
        !question.options.some((option: { isCorrect?: boolean }) => option.isCorrect)
    )
  ) {
    return 'Mỗi câu trắc nghiệm cần nội dung, ít nhất 2 đáp án và một đáp án đúng'
  }
  if (type === 'multiple_choice' && assignmentQuestions.length === 0) return 'Bài trắc nghiệm cần có ít nhất một câu hỏi'
  if (type === 'essay' && !assignmentQuestions[0]?.content?.trim()) return 'Vui lòng nhập câu hỏi tự luận'
  return null
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const validationError = validateAssignment(body)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const maxAttempts = body.maxAttempts !== undefined ? Math.max(0, Number(body.maxAttempts) || 0) : 1
    const durationMinutes = body.durationMinutes !== undefined ? Math.max(0, Number(body.durationMinutes) || 0) : 20
    const rawTargetClasses = Array.isArray(body.targetClassIds) ? body.targetClassIds : []
    const previous = await prisma.assignment.findUnique({
      where: { id },
      include: { distributions: true, questions: { include: { options: true } } },
    }).catch(() => null)

    let updatedDbAssignment
    try {
      if (!previous) {
        return NextResponse.json({ error: 'Không tìm thấy bài tập' }, { status: 404 })
      }

      if (Array.isArray(body.targetClassIds)) {
        await prisma.assignmentDistribution.deleteMany({ where: { assignmentId: id } })
        await prisma.assignmentDistribution.createMany({
          data: rawTargetClasses.map((clsId: string) => ({
            assignmentId: id,
            classId: clsId,
          })),
        })
      }

      await prisma.assignment.update({
        where: { id },
        data: {
          title: String(body.title).trim(),
          description: String(body.description || ''),
          type: body.type,
          gradeLevel: Number(body.gradeLevel),
          maxAttempts,
          aiPrompt: String(body.aiPrompt || ''),
          rubric: {
            ...((body.rubric as object) || {}),
            durationMinutes,
            attachments: Array.isArray(body.attachments)
              ? body.attachments
              : (body.rubric as any)?.attachments || (previous?.rubric as any)?.attachments || [],
          },
        },
      })

      if (Array.isArray(body.questions)) {
        await prisma.questionOption.deleteMany({ where: { question: { assignmentId: id } } })
        await prisma.question.deleteMany({ where: { assignmentId: id } })
        await prisma.question.createMany({
          data: body.questions.map((question: any, index: number) => ({
            assignmentId: id,
            orderIndex: index + 1,
            content: String(question.content || '').trim(),
            type: question.type || (body.type === 'multiple_choice' ? 'single_choice' : 'essay'),
            maxScore: Number(question.maxScore) || 1,
            correctAnswer: question.correctAnswer || null,
          })),
        })
        const savedQuestions = await prisma.question.findMany({
          where: { assignmentId: id },
          orderBy: { orderIndex: 'asc' },
        })
        await Promise.all(savedQuestions.map((question, index) =>
          prisma.questionOption.createMany({
            data: (body.questions[index]?.options || []).map((option: any, optionIndex: number) => ({
              questionId: question.id,
              label: String.fromCharCode(65 + optionIndex),
              content: String(option.text || '').trim(),
              isCorrect: Boolean(option.isCorrect),
            })),
          })
        ))
      }

      updatedDbAssignment = await prisma.assignment.findUnique({
        where: { id },
        include: { distributions: true, questions: { include: { options: true }, orderBy: { orderIndex: 'asc' } } },
      })
    } catch (dbErr) {
      console.warn('Lỗi cập nhật assignment trong Prisma DB:', dbErr)
    }

    if (!updatedDbAssignment) {
      return NextResponse.json({ error: 'Không thể cập nhật bài tập trong cơ sở dữ liệu' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Đã cập nhật bài tập', assignment: updatedDbAssignment })
  } catch (error) {
    console.error('Update assignment error:', error)
    return NextResponse.json({ error: 'Không thể cập nhật bài tập' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const maxAttempts = body.maxAttempts !== undefined ? Math.max(0, Number(body.maxAttempts) || 0) : undefined
    const durationMinutes = body.durationMinutes !== undefined ? Math.max(0, Number(body.durationMinutes) || 0) : undefined

    let updatedAssignment: any = null

    // 1. Cập nhật trực tiếp vào Supabase PostgreSQL qua Prisma
    try {
      const current = await prisma.assignment.findUnique({
        where: { id },
      })

      if (current) {
        const currentRubric = (current.rubric as Record<string, any>) || {}
        const updatedDb = await prisma.assignment.update({
          where: { id },
          data: {
            ...(maxAttempts !== undefined ? { maxAttempts } : {}),
            ...(durationMinutes !== undefined
              ? {
                  rubric: {
                    ...currentRubric,
                    durationMinutes,
                  },
                }
              : {}),
          },
          include: {
            distributions: true,
            questions: { include: { options: true } },
          },
        })

        updatedAssignment = {
          id: updatedDb.id,
          title: updatedDb.title,
          description: updatedDb.description,
          type: updatedDb.type,
          gradeLevel: updatedDb.gradeLevel,
          maxAttempts: updatedDb.maxAttempts,
          durationMinutes:
            (updatedDb.rubric as any)?.durationMinutes ?? durationMinutes ?? 20,
          targetClassIds: updatedDb.distributions.map((d) => d.classId),
          rubric: (updatedDb.rubric as any) || { criteria: [] },
          aiPrompt: updatedDb.aiPrompt,
          attachments: (updatedDb.rubric as any)?.attachments || [],
        }
      }
    } catch (dbErr) {
      console.warn('Lỗi khi cập nhật cấu hình assignment trong Prisma DB:', dbErr)
    }

    if (!updatedAssignment) {
      return NextResponse.json({ error: 'Không tìm thấy bài tập cần cập nhật cấu hình' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Cập nhật cấu hình làm bài thành công',
      assignment: updatedAssignment,
    })
  } catch (error) {
    console.error('Patch assignment settings error:', error)
    return NextResponse.json({ error: 'Không thể cập nhật cấu hình bài tập' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // 1. Xóa attachments trên Cloudinary nếu có
    const dbAssignment = await prisma.assignment.findUnique({ where: { id } }).catch(() => null)
    const attachments = (dbAssignment?.rubric as any)?.attachments || []
    if (attachments.length > 0) {
      await Promise.all(
        attachments.map(async (attachment: any) => {
          if (attachment.publicId) {
            await cloudinaryService.delete(
              attachment.publicId,
              attachment.mimeType?.startsWith('image/') ? 'image' : 'raw'
            ).catch(() => {})
          }
        })
      )
    }

    // 2. Xóa trong Prisma DB Supabase
    await prisma.submissionAnswer.deleteMany({
      where: { submission: { assignmentId: id } },
    }).catch(() => {})
    await prisma.submission.deleteMany({
      where: { assignmentId: id },
    }).catch(() => {})
    await prisma.assignmentDistribution.deleteMany({
      where: { assignmentId: id },
    }).catch(() => {})
    await prisma.questionOption.deleteMany({
      where: { question: { assignmentId: id } },
    }).catch(() => {})
    await prisma.question.deleteMany({
      where: { assignmentId: id },
    }).catch(() => {})
    await prisma.assignment.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Đã xóa bài tập và các bài nộp liên quan' })
  } catch (error) {
    console.error('Delete assignment error:', error)
    return NextResponse.json({ error: 'Không thể xóa bài tập' }, { status: 500 })
  }
}
