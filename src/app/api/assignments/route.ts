import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const gradeLevel = searchParams.get('gradeLevel')
  const classId = searchParams.get('classId')

  try {
    const dbAssignments = await prisma.assignment.findMany({
      where: {
        ...(gradeLevel ? { gradeLevel: Number(gradeLevel) } : {}),
        ...(classId
          ? {
              distributions: {
                some: { classId },
              },
            }
          : {}),
      },
      include: {
        distributions: true,
        questions: {
          include: { options: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const assignments = dbAssignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      type: a.type,
      gradeLevel: a.gradeLevel,
      maxScore: a.maxScore,
      targetClassIds: a.distributions.map((d) => d.classId),
      startDate: a.startDate?.toISOString() || a.createdAt.toISOString(),
      dueDate: a.dueDate?.toISOString() || new Date(Date.now() + 14 * 86400000).toISOString(),
      isPublished: a.isPublished,
      rubric: (a.rubric as any) || { criteria: [] },
      aiPrompt: a.aiPrompt,
      maxAttempts: a.maxAttempts,
      durationMinutes: (a.rubric as any)?.durationMinutes ?? 20,
      attachments: (a.rubric as any)?.attachments || [],
      questions: a.questions.map((q) => ({
        id: q.id,
        content: q.content,
        type: q.type,
        maxScore: q.maxScore,
        correctAnswer: q.correctAnswer || undefined,
        options: q.options.map((opt) => ({
          label: opt.label,
          text: opt.content,
          isCorrect: opt.isCorrect,
        })),
      })),
    }))

    return NextResponse.json({ assignments })
  } catch (err) {
    console.error('Lỗi đọc assignments từ Prisma DB:', err)
    return NextResponse.json({ error: 'Không thể đọc bài tập từ cơ sở dữ liệu' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      type,
      gradeLevel,
      targetClassIds,
      rubric,
      aiPrompt,
      questions,
      attachments,
      maxAttempts,
      durationMinutes,
    } = body

    if (!title || !type || !gradeLevel) {
      return NextResponse.json({ error: 'Tiêu đề, thể loại và khối lớp là bắt buộc' }, { status: 400 })
    }

    if (!['multiple_choice', 'essay', 'practice'].includes(type)) {
      return NextResponse.json({ error: 'Hình thức bài tập không hợp lệ' }, { status: 400 })
    }

    const validQuestions = Array.isArray(questions) ? questions : []
    if (type === 'multiple_choice') {
      if (validQuestions.length === 0) {
        return NextResponse.json({ error: 'Bài trắc nghiệm cần có ít nhất một câu hỏi' }, { status: 400 })
      }
      const invalidQuestion = validQuestions.some(
        (question) =>
          !question.content?.trim() ||
          !Array.isArray(question.options) ||
          question.options.length < 2 ||
          question.options.some((option: { text?: string }) => !option.text?.trim()) ||
          !question.options.some((option: { isCorrect?: boolean }) => option.isCorrect)
      )
      if (invalidQuestion) {
        return NextResponse.json(
          { error: 'Mỗi câu trắc nghiệm cần nội dung, ít nhất 2 đáp án và một đáp án đúng' },
          { status: 400 }
        )
      }
    }

    if (type === 'essay' && (!validQuestions[0]?.content || !validQuestions[0].content.trim())) {
      return NextResponse.json({ error: 'Vui lòng nhập câu hỏi tự luận' }, { status: 400 })
    }

    // Tìm giáo viên để liên kết bài tập
    const teacherProfile = await prisma.teacherProfile.findFirst()

    const rawTargetClasses = Array.isArray(targetClassIds) ? targetClassIds : []

    // Lưu vào Prisma DB Supabase
    let dbCreatedId = body.id
    if (teacherProfile) {
      try {
        const createdAssignment = await prisma.assignment.create({
          data: {
            title,
            description: description || '',
            type,
            gradeLevel: Number(gradeLevel),
            maxScore: 10,
            maxAttempts: maxAttempts !== undefined ? Math.max(0, Number(maxAttempts) || 0) : 1,
            teacherId: teacherProfile.id,
            isPublished: true,
            rubric: {
              ...((rubric as object) || {}),
              durationMinutes: durationMinutes !== undefined ? Math.max(0, Number(durationMinutes) || 0) : 20,
              attachments: Array.isArray(attachments) ? attachments : [],
            },
            aiPrompt: aiPrompt || '',
            distributions: {
              create: rawTargetClasses.map((clsId: string) => ({
                classId: clsId,
              })),
            },
            questions: {
              create: validQuestions.map((q, idx) => ({
                orderIndex: idx + 1,
                content: q.content.trim(),
                type: q.type || (type === 'multiple_choice' ? 'single_choice' : 'essay'),
                maxScore: Number(q.maxScore) || 1,
                correctAnswer: q.correctAnswer || null,
                options: Array.isArray(q.options)
                  ? {
                      create: q.options.map((opt: any, optIdx: number) => ({
                        label: String.fromCharCode(65 + optIdx),
                        content: opt.text?.trim() || '',
                        isCorrect: Boolean(opt.isCorrect),
                      })),
                    }
                  : undefined,
              })),
            },
          },
        })
        dbCreatedId = createdAssignment.id
      } catch (dbErr) {
        console.warn('Lỗi lưu assignment vào Prisma DB:', dbErr)
      }
    }

    const newAssignment = {
      id: dbCreatedId || `asg-${Date.now()}`,
      title,
      description: description || '',
      type,
      gradeLevel: Number(gradeLevel),
      targetClassIds: rawTargetClasses,
      maxScore: 10,
      maxAttempts: maxAttempts !== undefined ? Math.max(0, Number(maxAttempts) || 0) : 1,
      durationMinutes: durationMinutes !== undefined ? Math.max(0, Number(durationMinutes) || 0) : 20,
      startDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      isPublished: true,
      rubric: rubric || {
        criteria: [
          { name: 'Kỹ năng thực hành', maxScore: 5, description: 'Đúng các thao tác yêu cầu' },
          { name: 'Trình bày và thẩm mỹ', maxScore: 3, description: 'Bố cục hài hòa, dễ nhìn' },
          { name: 'Tính sáng tạo', maxScore: 2, description: 'Ý tưởng mới mẻ' },
        ],
      },
      aiPrompt: aiPrompt || '',
      questions: validQuestions.map((question, index) => ({
        id: question.id || `q-${Date.now()}-${index + 1}`,
        content: question.content.trim(),
        type: question.type || (type === 'multiple_choice' ? 'single_choice' : 'essay'),
        options: Array.isArray(question.options)
          ? question.options.map((option: { text: string; isCorrect: boolean }, optionIndex: number) => ({
              label: String.fromCharCode(65 + optionIndex),
              text: option.text.trim(),
              isCorrect: Boolean(option.isCorrect),
            }))
          : undefined,
        correctAnswer: question.correctAnswer,
        maxScore: Number(question.maxScore) || 1,
      })),
      attachments: Array.isArray(attachments) ? attachments : [],
    }

    return NextResponse.json({ message: 'Tạo bài tập thành công', assignment: newAssignment }, { status: 201 })
  } catch (error) {
    console.error('Create assignment error:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi tạo bài tập' }, { status: 500 })
  }
}
