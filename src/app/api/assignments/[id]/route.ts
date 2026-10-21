import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { store } from '@/lib/data-store'
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

    // 1. Cập nhật trong Prisma DB Supabase
    let updatedDbAssignment: any = null
    try {
      // Xóa và tạo lại distributions nếu có
      if (rawTargetClasses.length > 0) {
        await prisma.assignmentDistribution.deleteMany({ where: { assignmentId: id } }).catch(() => {})
        await prisma.assignmentDistribution.createMany({
          data: rawTargetClasses.map((clsId: string) => ({
            assignmentId: id,
            classId: clsId,
          })),
        }).catch(() => {})
      }

      updatedDbAssignment = await prisma.assignment.update({
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
              : (body.rubric as any)?.attachments || previous?.attachments || [],
          },
        },
        include: {
          distributions: true,
          questions: { include: { options: true } },
        },
      })
    } catch (dbErr) {
      console.warn('Lỗi cập nhật assignment trong Prisma DB:', dbErr)
    }

    // 2. Cập nhật trong store in-memory (fallback & sync)
    const index = store.assignments.findIndex((assignment) => assignment.id === id)
    const previous = index >= 0 ? store.assignments[index] : null

    const questions = Array.isArray(body.questions)
      ? body.questions.map((question: any, questionIndex: number) => ({
          id: question.id || previous?.questions?.[questionIndex]?.id || `q-${Date.now()}-${questionIndex + 1}`,
          content: question.content.trim(),
          type: question.type || (body.type === 'multiple_choice' ? 'single_choice' : 'essay'),
          options: Array.isArray(question.options)
            ? question.options.map((option: { text: string; isCorrect: boolean }, optionIndex: number) => ({
                label: String.fromCharCode(65 + optionIndex),
                text: option.text.trim(),
                isCorrect: Boolean(option.isCorrect),
              }))
            : undefined,
          maxScore: Number(question.maxScore) || 1,
        }))
      : previous?.questions || []

    const updated = {
      id,
      title: String(body.title).trim(),
      description: String(body.description || ''),
      type: body.type,
      gradeLevel: Number(body.gradeLevel),
      targetClassIds: rawTargetClasses.length > 0 ? rawTargetClasses : previous?.targetClassIds || [],
      aiPrompt: String(body.aiPrompt || ''),
      maxAttempts,
      durationMinutes,
      questions,
      maxScore: 10,
      startDate: previous?.startDate || new Date().toISOString(),
      dueDate: previous?.dueDate || new Date(Date.now() + 14 * 86400000).toISOString(),
      isPublished: true,
      rubric: body.rubric || previous?.rubric || { criteria: [] },
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    }

    if (index >= 0) {
      store.assignments[index] = updated
    } else {
      store.assignments.unshift(updated)
    }

    return NextResponse.json({ message: 'Đã cập nhật bài tập', assignment: updated })
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
          attachments: (updatedDb.rubric as any)?.attachments || (store.assignments.find((s) => s.id === updatedDb.id)?.attachments) || [],
        }
      }
    } catch (dbErr) {
      console.warn('Lỗi khi cập nhật cấu hình assignment trong Prisma DB:', dbErr)
    }

    // 2. Cập nhật hoặc đồng bộ hóa trong store in-memory
    const index = store.assignments.findIndex((assignment) => assignment.id === id)
    if (index >= 0) {
      const target = store.assignments[index]
      if (maxAttempts !== undefined) target.maxAttempts = maxAttempts
      if (durationMinutes !== undefined) target.durationMinutes = durationMinutes
      if (!updatedAssignment) {
        updatedAssignment = target
      }
    } else if (updatedAssignment) {
      store.assignments.push(updatedAssignment)
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

    // 1. Xóa trong Prisma DB Supabase
    try {
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
      }).catch(() => {})
    } catch (dbErr) {
      console.warn('Lỗi khi xóa assignment trong Prisma DB:', dbErr)
    }

    // 2. Xóa attachments trên Cloudinary hoặc ổ cứng nếu có
    const assignment = store.assignments.find((item) => item.id === id)
    if (assignment) {
      await Promise.all(
        (assignment.attachments || []).map(async (attachment: any) => {
          if (attachment.publicId) {
            await cloudinaryService.delete(
              attachment.publicId,
              attachment.mimeType?.startsWith('image/') ? 'image' : 'raw'
            ).catch(() => {})
          } else if (!attachment.url?.includes('cloudinary.com')) {
            const fileName = path.basename(attachment.url)
            try {
              await unlink(path.join(process.cwd(), 'public', 'uploads', 'assignments', fileName))
            } catch (error: any) {
              if (error.code !== 'ENOENT') throw error
            }
          }
        })
      )
    }

    // 3. Xóa trong store in-memory
    store.assignments = store.assignments.filter((item) => item.id !== id)
    store.submissions = store.submissions.filter((submission) => submission.assignmentId !== id)

    return NextResponse.json({ message: 'Đã xóa bài tập và các bài nộp liên quan' })
  } catch (error) {
    console.error('Delete assignment error:', error)
    return NextResponse.json({ error: 'Không thể xóa bài tập' }, { status: 500 })
  }
}
