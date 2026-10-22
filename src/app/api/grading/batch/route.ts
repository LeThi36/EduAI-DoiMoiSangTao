import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { AssignmentItem, SubmissionItem } from '@/lib/data-store'
import { EvaluationService } from '@/lib/ai/services/evaluation.service'
import { formatUserFriendlyAIError } from '@/lib/ai/providers/gemini.provider'

/**
 * Lấy bài nộp MỚI NHẤT (lần làm cuối) của mỗi học sinh trong lớp cho 1 bài tập.
 * Ưu tiên truy vấn trực tiếp từ Database Supabase PostgreSQL, sau đó kết hợp với memory cache.
 */
async function getLatestSubmissionsOfClass(
  assignmentId: string,
  classId: string,
  className: string,
  assignmentAltId?: string
): Promise<SubmissionItem[]> {
  const latest = new Map<string, SubmissionItem>()

  // 1. Lấy từ Database Supabase PostgreSQL qua Prisma
  try {
    const dbSubs = await prisma.submission.findMany({
      where: {
        OR: [
          { assignmentId },
          { assignment: { title: assignmentId } },
          ...(assignmentAltId
            ? [{ assignmentId: assignmentAltId }, { assignment: { title: assignmentAltId } }]
            : []),
        ],
        student: {
          enrollments: {
            some: {
              OR: [{ classId }, { class: { name: className } }],
            },
          },
        },
      },
      include: {
        assignment: true,
        student: {
          include: {
            user: true,
            enrollments: {
              include: { class: true },
            },
          },
        },
        files: true,
        answers: true,
        aiEvaluation: {
          include: { criterionScores: true },
        },
        teacherReview: true,
      },
      orderBy: { submittedAt: 'desc' },
    })

    for (const s of dbSubs) {
      const file = s.files[0]
      const evalJson = s.aiEvaluation?.resultJson as any
      const key = s.student.userId || s.studentId
      if (!latest.has(key)) {
        latest.set(key, {
          id: s.id,
          assignmentId: s.assignmentId,
          assignmentTitle: s.assignment.title,
          studentId: s.student.userId,
          studentProfileId: s.studentId,
          studentName: s.student.user.fullName,
          studentCode: s.student.studentId,
          classId: s.student.enrollments[0]?.class?.id || '',
          className: s.student.enrollments[0]?.class?.name || '',
          status: s.status as any,
          submittedAt: s.submittedAt ? s.submittedAt.toISOString() : s.createdAt.toISOString(),
          attemptNumber: s.attemptNumber,
          isAutoSubmitted: Boolean(evalJson?.isAutoSubmitted),
          content:
            evalJson?.submissionContent ||
            (evalJson as any)?.content ||
            s.answers.map((a) => a.answer).filter(Boolean).join('\n') || '',
          fileName: file?.fileName || '',
          fileUrl: file?.fileUrl || '',
          answers: s.answers.map((a) => ({
            questionId: a.questionId,
            selectedLabel: a.answer,
            text: a.answer,
            score: a.score ?? undefined,
            isCorrect: a.isCorrect ?? undefined,
          })),
          quizResult: evalJson?.quizResult,
          aiEvaluation: s.aiEvaluation
            ? {
                score: s.aiEvaluation.suggestedScore ?? 0,
                strengths: s.aiEvaluation.strengths ?? '',
                weaknesses: s.aiEvaluation.weaknesses ?? '',
                suggestions: s.aiEvaluation.suggestions ?? '',
                criteriaScores:
                  s.aiEvaluation.criterionScores?.map((c) => ({
                    criterion: c.criterionName,
                    score: c.suggestedScore,
                    maxScore: c.maxScore,
                    evidence: c.evidence ?? '',
                  })) || [],
              }
            : undefined,
          teacherReview: s.teacherReview
            ? {
                finalScore: s.teacherReview.finalScore,
                feedback: s.teacherReview.finalFeedback,
                reviewedAt: s.teacherReview.reviewedAt ? s.teacherReview.reviewedAt.toISOString() : '',
                isPublished: s.teacherReview.isPublished,
              }
            : undefined,
        })
      }
    }
  } catch (err) {
    console.warn('[BatchGrading] Lỗi đọc bài nộp từ Prisma DB:', err)
  }

  return [...latest.values()]
}

const isGraded = (sub: SubmissionItem) => Boolean(sub.aiEvaluation)

/**
 * POST /api/grading/batch
 * Giáo viên cho AI chấm hàng loạt theo lớp.
 * body: {
 *   assignmentId: string
 *   classId: string
 *   batchSize?: number      // số học sinh chấm trong 1 lượt (giảm tải AI), mặc định 5
 *   studentIds?: string[]   // chỉ định học sinh cụ thể (bỏ qua batchSize)
 *   regrade?: boolean       // chấm lại cả bài đã được AI chấm
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assignmentId, classId, studentIds, regrade } = body
    const batchSize = Math.min(50, Math.max(1, Number(body.batchSize) || 5))

    // 1. Lấy Assignment trực tiếp từ database
    let assignment: AssignmentItem | undefined
    try {
        const dbA = await prisma.assignment.findFirst({
          where: {
            OR: [{ id: assignmentId }, { title: assignmentId }],
          },
          include: {
            distributions: true,
            questions: { include: { options: true } },
          },
        })
        if (dbA) {
          const mappedAssignment: AssignmentItem = {
            id: dbA.id,
            title: dbA.title,
            description: dbA.description,
            type: dbA.type as any,
            gradeLevel: dbA.gradeLevel,
            maxScore: dbA.maxScore,
            targetClassIds: dbA.distributions.map((d) => d.classId),
            startDate: dbA.startDate?.toISOString() || '',
            dueDate: dbA.dueDate?.toISOString() || '',
            isPublished: dbA.isPublished,
            rubric: (dbA.rubric as any) || { criteria: [] },
            aiPrompt: dbA.aiPrompt,
            teacherId: dbA.teacherId,
            maxAttempts: dbA.maxAttempts,
            questions: dbA.questions.map((q) => ({
              id: q.id,
              content: q.content,
              type: q.type as any,
              maxScore: q.maxScore,
              correctAnswer: q.correctAnswer || undefined,
              options: q.options.map((opt) => ({
                label: opt.label,
                text: opt.content,
                isCorrect: opt.isCorrect,
              })),
            })),
          }
          assignment = mappedAssignment
        }
    } catch (err) {
      console.warn('Lỗi tìm assignment trong Prisma DB:', err)
    }

    // 2. Lấy lớp trực tiếp từ database
    let cls: { id: string; name: string; code: string } | undefined
    try {
        const dbC = await prisma.class.findFirst({
          where: {
            OR: [{ id: classId }, { code: classId }, { name: classId }],
          },
        })
        if (dbC) {
          cls = {
            id: dbC.id,
            name: dbC.name,
            code: dbC.code,
          }
        }
    } catch (err) {
      console.warn('Lỗi tìm class trong Prisma DB:', err)
    }

    if (!assignment || !cls) {
      return NextResponse.json(
        {
          error: 'Bài tập hoặc lớp không hợp lệ. Vui lòng kiểm tra assignmentId và classId.',
          debug: { assignmentId, classId, foundAssignment: Boolean(assignment), foundClass: Boolean(cls) },
        },
        { status: 400 }
      )
    }

    const pickedIds: string[] = Array.isArray(studentIds) ? studentIds.filter(Boolean) : []
    let candidates = await getLatestSubmissionsOfClass(assignmentId, cls.id, cls.name, assignment.id)
    if (pickedIds.length > 0) candidates = candidates.filter((s) => pickedIds.includes(s.studentId))

    // Nếu giáo viên yêu cầu chấm lại (regrade = true) hoặc chọn học sinh cụ thể (pickedIds): cho phép AI chấm/phân tích lại cả bài trắc nghiệm
    // Nếu là chấm tự động hàng loạt chưa regrade: chỉ chấm các bài chưa có điểm AI
    const queue = candidates.filter((s) => regrade || pickedIds.length > 0 || (!s.quizResult && !isGraded(s)))

    const toGrade = pickedIds.length > 0 ? queue : queue.slice(0, batchSize)
    const graded: string[] = []
    const failed: { submissionId: string; studentName: string; error: string }[] = []

    // Chấm tuần tự từng bài để tránh dồn tải lên AI
    for (const sub of toGrade) {
      try {
        const isQuiz = Boolean(sub.quizResult || assignment.type === 'multiple_choice' || (assignment.questions && assignment.questions.length > 0))
        let submissionContent = sub.content || ''
        let rubricToUse = assignment.rubric
        let quizGradedItems: any[] = []

        if (isQuiz && assignment.questions && assignment.questions.length > 0) {
          // Trích xuất đáp án đã chọn của học sinh từ sub.quizResult.items, sub.answers, hoặc parse sub.content
          const rawContent = sub.content || ''
          const contentMatchMap = new Map<number, string>()
          const regex = /Câu\s*(\d+)[:\s]*([A-Za-z0-9]+)/gi
          let m: RegExpExecArray | null
          while ((m = regex.exec(rawContent)) !== null) {
            contentMatchMap.set(Number(m[1]), m[2].trim().toUpperCase())
          }

          quizGradedItems = assignment.questions.map((q, idx) => {
            const index = idx + 1
            const fromAnswers = (sub as any).answers?.find((a: any) => a.questionId === q.id)
            const fromQuizRes = sub.quizResult?.items?.find((it: any) => it.questionId === q.id || it.index === index)
            const fromContent = contentMatchMap.get(index)

            const selectedLabel = (
              fromQuizRes?.selectedLabel ||
              fromAnswers?.selectedLabel ||
              fromAnswers?.text ||
              fromContent ||
              ''
            ).trim().toUpperCase()

            const correctOpt = q.options?.find((o) => o.isCorrect)
            const selectedOpt = q.options?.find((o) => o.label?.toUpperCase() === selectedLabel)
            const isCorrect = Boolean(selectedLabel && correctOpt && correctOpt.label?.toUpperCase() === selectedLabel)
            const maxScore = q.maxScore || 1
            const score = isCorrect ? maxScore : 0

            return {
              questionId: q.id,
              index,
              content: q.content,
              selectedLabel: selectedLabel || 'Chưa chọn',
              selectedText: selectedOpt?.text || '',
              correctLabel: correctOpt?.label || '',
              correctText: correctOpt?.text || '',
              isCorrect,
              score,
              maxScore,
            }
          })

          const totalWeight = quizGradedItems.reduce((s, g) => s + g.maxScore, 0) || 1
          const totalEarned = quizGradedItems.reduce((s, g) => s + g.score, 0)
          const quizScore = Math.round((totalEarned / totalWeight) * assignment.maxScore * 10) / 10

          submissionContent = `[CHI TIẾT BÀI LÀM TRẮC NGHIỆM CỦA HỌC SINH]:\n` +
            quizGradedItems.map((g) => {
              const resText = g.isCorrect
                ? `ĐÚNG (Đạt ${g.score}/${g.maxScore} điểm)`
                : `SAI (Học sinh chọn: ${g.selectedLabel}${g.selectedText ? ` - ${g.selectedText}` : ''}; Đáp án đúng: ${g.correctLabel}${g.correctText ? ` - ${g.correctText}` : ''})`
              return `- Câu ${g.index} (${g.content}): ${resText}`
            }).join('\n')

          rubricToUse = {
            criteria: quizGradedItems.map((g) => ({
              name: `Câu ${g.index}: ${g.content}`,
              maxScore: g.maxScore,
              description: `Học sinh trả lời đúng câu ${g.index} (${g.correctLabel})`,
            })),
          }
        }

        let aiEval: any = null
        try {
          aiEval = await EvaluationService.evaluate({
            assignmentTitle: assignment.title,
            gradeLevel: assignment.gradeLevel,
            submissionContent,
            fileMetadata: sub.fileName ? { name: sub.fileName, type: 'document', size: 1024 } : undefined,
            rubric: rubricToUse,
            customTeacherPrompt: assignment.aiPrompt,
          }, (assignment as any).teacherId)
        } catch (evalErr: any) {
          if (isQuiz && quizGradedItems.length > 0) {
            console.warn('[BatchGrading] Google AI tạm thời bị quá tải 503, tự động kích hoạt bộ phân tích sư phạm dự phòng theo đáp án...')
            const right = quizGradedItems.filter((g) => g.isCorrect)
            const wrong = quizGradedItems.filter((g) => !g.isCorrect)
            aiEval = {
              totalScore: Math.round((quizGradedItems.reduce((s, g) => s + g.score, 0) / (quizGradedItems.reduce((s, g) => s + g.maxScore, 0) || 1)) * assignment.maxScore * 10) / 10,
              strengths: right.length > 0
                ? `Thầy/Cô thấy em đã nắm vững kiến thức và trả lời đúng ${right.length}/${quizGradedItems.length} câu hỏi (${right.map((r) => `Câu ${r.index}`).join(', ')}).`
                : null,
              weaknesses: wrong.length > 0
                ? `Em cần chú ý xem lại và ôn tập các câu chưa làm đúng (${wrong.map((w) => `Câu ${w.index}`).join(', ')}).`
                : null,
              suggestions: wrong.length > 0
                ? `Em hãy đọc kỹ lại đề bài, quan sát các đáp án và ôn tập lại bài cùng Thầy/Cô nhé.`
                : `Em đã hoàn thành rất tốt bài tập, tiếp tục phát huy ở các bài tiếp theo nhé!`,
              criterionScores: [],
            }
          } else {
            throw evalErr
          }
        }

        const rawScores = Array.isArray(aiEval?.criterionScores)
          ? aiEval.criterionScores
          : Array.isArray((aiEval as any)?.criteriaScores)
            ? (aiEval as any).criteriaScores
            : Array.isArray((aiEval as any)?.criteria)
              ? (aiEval as any).criteria
              : []

        let criteriaScores = []
        if (quizGradedItems.length > 0) {
          criteriaScores = quizGradedItems.map((g) => ({
            criterion: `Câu ${g.index}`,
            score: g.score,
            maxScore: g.maxScore,
            evidence: g.isCorrect
              ? `Chọn ${g.selectedLabel} (đúng)`
              : `Chọn ${g.selectedLabel} (sai, đúng là ${g.correctLabel})`,
          }))
        } else {
          criteriaScores = rawScores.map((c: any) => ({
            criterion: c.criterionName || c.criterion || c.name || 'Tiêu chí',
            score: Number(c.suggestedScore ?? c.score ?? 0),
            maxScore: Number(c.maxScore ?? 10),
            evidence: c.evidence || c.feedback || '',
          }))
        }

        if (criteriaScores.length === 0) {
          criteriaScores.push({
            criterion: 'Đánh giá chung',
            score: Number(aiEval?.totalScore ?? 8),
            maxScore: 10,
            evidence: aiEval?.strengths || 'Học sinh đã hoàn thành bài làm.',
          })
        }

        const calculatedScore = quizGradedItems.length > 0
          ? Math.round((quizGradedItems.reduce((s, g) => s + g.score, 0) / (quizGradedItems.reduce((s, g) => s + g.maxScore, 0) || 1)) * assignment.maxScore * 10) / 10
          : Number(aiEval?.totalScore ?? 0)

        sub.aiEvaluation = {
          score: calculatedScore,
          strengths: aiEval?.strengths ?? null,
          weaknesses: aiEval?.weaknesses ?? null,
          suggestions: aiEval?.suggestions ?? null,
          criteriaScores,
        }
        sub.aiGradedAt = new Date().toISOString()
        sub.aiError = undefined
        if (sub.status === 'submitted') sub.status = 'grading'

        // LƯU TRỰC TIẾP VÀO DATABASE SUPABASE POSTGRESQL QUA PRISMA
        try {
          let dbSubmission = await prisma.submission.findUnique({ where: { id: sub.id } })

          // Tạo bản ghi nếu bài nộp chưa tồn tại trong database.
          if (!dbSubmission) {
            const dbStu = await prisma.studentProfile.findFirst({
              where: {
                OR: [
                  { userId: sub.studentId },
                  { id: sub.studentId },
                  { studentId: sub.studentCode },
                ],
              },
            })
            const dbAsg = await prisma.assignment.findFirst({
              where: {
                OR: [{ id: sub.assignmentId }, { title: sub.assignmentTitle }],
              },
            })

            if (dbStu && dbAsg) {
              dbSubmission = await prisma.submission.create({
                data: {
                  id: sub.id.startsWith('sub-') ? sub.id : undefined,
                  assignmentId: dbAsg.id,
                  studentId: dbStu.id,
                  attemptNumber: sub.attemptNumber || 1,
                  status: 'grading',
                  totalScore: Number(aiEval?.totalScore ?? 0),
                  submittedAt: new Date(sub.submittedAt || Date.now()),
                  ...(sub.fileName || sub.fileUrl
                    ? {
                        files: {
                          create: {
                            fileName: sub.fileName || 'file_nop_bai',
                            fileUrl: sub.fileUrl || '',
                            fileType: sub.fileName?.split('.').pop() || 'raw',
                            fileSize: 0,
                          },
                        },
                      }
                    : {}),
                },
              })
              sub.id = dbSubmission.id
            }
          }

          if (dbSubmission) {
            const dbEval = await prisma.aIEvaluation.upsert({
              where: { submissionId: dbSubmission.id },
              create: {
                submissionId: dbSubmission.id,
                provider: 'gemini',
                model: 'gemini-2.0-flash',
                status: 'completed',
                suggestedScore: calculatedScore,
                strengths: aiEval?.strengths || '',
                weaknesses: aiEval?.weaknesses || '',
                suggestions: aiEval?.suggestions || '',
                resultJson: {
                  ...(aiEval as any),
                  submissionContent: sub.content || '',
                },
              },
              update: {
                provider: 'gemini',
                status: 'completed',
                suggestedScore: calculatedScore,
                strengths: aiEval?.strengths || '',
                weaknesses: aiEval?.weaknesses || '',
                suggestions: aiEval?.suggestions || '',
                resultJson: {
                  ...(aiEval as any),
                  submissionContent: sub.content || '',
                },
                errorMessage: null,
              },
            })

            await prisma.aICriterionScore.deleteMany({ where: { evaluationId: dbEval.id } }).catch(() => {})
            if (criteriaScores.length > 0) {
              await prisma.aICriterionScore.createMany({
                data: criteriaScores.map((c: { criterion: string; score: number; maxScore: number; evidence: string }) => ({
                  evaluationId: dbEval.id,
                  criterionName: c.criterion,
                  maxScore: Number(c.maxScore || 10),
                  suggestedScore: Number(c.score || 0),
                  evidence: c.evidence,
                })),
              }).catch(() => {})
            }

            await prisma.submission.update({
              where: { id: dbSubmission.id },
              data: {
                status: 'grading',
                totalScore: calculatedScore,
              },
            }).catch(() => {})
          }
        } catch (dbErr) {
          console.warn('[BatchGrading] Lưu AI evaluation vào DB thất bại:', dbErr)
        }

        graded.push(sub.id)
      } catch (err: any) {
        console.error('[BatchGrading] Lỗi khi chấm bài cho học sinh:', sub.studentName, err)
        sub.aiError = formatUserFriendlyAIError(err)
        failed.push({ submissionId: sub.id, studentName: sub.studentName, error: sub.aiError! })
      }
    }

    // Tính lại số bài còn chờ chấm trong lớp sau lượt này
    const remainingCandidates = await getLatestSubmissionsOfClass(assignmentId, cls.id, cls.name, assignment.id)
    const remaining = remainingCandidates.filter(
      (s) => !s.quizResult && !isGraded(s)
    ).length

    return NextResponse.json({
      message: `AI đã chấm ${graded.length} bài${failed.length ? `, lỗi ${failed.length} bài` : ''}`,
      graded,
      failed,
      remaining,
    })
  } catch (error) {
    console.error('Batch grading error:', error)
    return NextResponse.json({ error: 'Không thể chấm hàng loạt' }, { status: 500 })
  }
}
