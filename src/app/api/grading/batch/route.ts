import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { store } from '@/lib/data-store'
import type { SubmissionItem } from '@/lib/data-store'
import { EvaluationService } from '@/lib/ai/services/evaluation.service'

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
            s.answers.map((a) => a.answer).filter(Boolean).join('\n') ||
            store.submissions.find((m) => m.id === s.id)?.content ||
            '',
          fileName: file?.fileName || '',
          fileUrl: file?.fileUrl || '',
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

  // 2. Bổ sung từ memory store nếu có bài nộp mới hơn hoặc chưa lưu vào DB
  for (const sub of store.submissions) {
    const matchAsg =
      sub.assignmentId === assignmentId ||
      sub.assignmentTitle === assignmentId ||
      (assignmentAltId && (sub.assignmentId === assignmentAltId || sub.assignmentTitle === assignmentAltId))
    if (!matchAsg) continue

    const matchesClass =
      sub.className === className ||
      sub.classId === classId ||
      store.students.some(
        (st) =>
          (st.id === sub.studentId || st.studentId === sub.studentId) &&
          (st.classId === classId || st.className === className)
      ) ||
      (!sub.classId && !sub.className)

    if (!matchesClass) continue

    const prev = latest.get(sub.studentId)
    if (!prev || new Date(sub.submittedAt).getTime() > new Date(prev.submittedAt).getTime()) {
      latest.set(sub.studentId, sub)
    }
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

    // 1. Tìm Assignment trong store hoặc Database Supabase
    let assignment = store.assignments.find((a) => a.id === assignmentId || a.title === assignmentId)
    if (!assignment) {
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
          assignment = {
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
          store.assignments.push(assignment)
        }
      } catch (err) {
        console.warn('Lỗi tìm assignment trong Prisma DB:', err)
      }
    }

    // 2. Tìm Class trong store hoặc Database Supabase
    let cls = store.classes.find((c) => c.id === classId || c.name === classId || c.code === classId)
    if (!cls) {
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
            schoolYearId: dbC.schoolYearId,
            gradeId: dbC.gradeId,
            teacherId: dbC.teacherId,
            teacherName: 'Giáo viên',
            studentCount: 0,
            isActive: dbC.isActive,
            isArchived: dbC.isArchived,
          }
          store.classes.push(cls)
        }
      } catch (err) {
        console.warn('Lỗi tìm class trong Prisma DB:', err)
      }
    }

    // 3. Nếu vẫn chưa tìm thấy class (do ID tùy biến từ client), kiểm tra trong danh sách học sinh
    if (!cls && classId) {
      const studentWithClass = store.students.find((s) => s.classId === classId || s.className === classId)
      if (studentWithClass) {
        cls = {
          id: studentWithClass.classId || classId,
          name: studentWithClass.className || classId,
          code: studentWithClass.className || classId,
          schoolYearId: studentWithClass.schoolYearId || '',
          gradeId: '',
          teacherId: '',
          teacherName: 'Giáo viên',
          studentCount: 1,
          isActive: true,
          isArchived: false,
        }
        store.classes.push(cls)
      }
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

    // Bài trắc nghiệm đã được chấm tự động theo đáp án ngay khi nộp → không cần gọi lại AI
    const queue = candidates.filter((s) => !s.quizResult && (regrade || !isGraded(s)))

    const toGrade = pickedIds.length > 0 ? queue : queue.slice(0, batchSize)
    const graded: string[] = []
    const failed: { submissionId: string; studentName: string; error: string }[] = []

    // Chấm tuần tự từng bài để tránh dồn tải lên AI
    for (const sub of toGrade) {
      try {
        const aiEval = await EvaluationService.evaluate({
          assignmentTitle: assignment.title,
          gradeLevel: assignment.gradeLevel,
          submissionContent: sub.content || '',
          fileMetadata: sub.fileName ? { name: sub.fileName, type: 'document', size: 1024 } : undefined,
          rubric: assignment.rubric,
          customTeacherPrompt: assignment.aiPrompt,
        }, (assignment as any).teacherId)
        const rawScores = Array.isArray(aiEval?.criterionScores)
          ? aiEval.criterionScores
          : Array.isArray((aiEval as any)?.criteriaScores)
            ? (aiEval as any).criteriaScores
            : Array.isArray((aiEval as any)?.criteria)
              ? (aiEval as any).criteria
              : []

        const criteriaScores = rawScores.map((c: any) => ({
          criterion: c.criterionName || c.criterion || c.name || 'Tiêu chí',
          score: Number(c.suggestedScore ?? c.score ?? 0),
          maxScore: Number(c.maxScore ?? 10),
          evidence: c.evidence || c.feedback || '',
        }))

        if (criteriaScores.length === 0) {
          criteriaScores.push({
            criterion: 'Đánh giá chung',
            score: Number(aiEval?.totalScore ?? 8),
            maxScore: 10,
            evidence: aiEval?.strengths || 'Học sinh đã hoàn thành bài làm.',
          })
        }

        sub.aiEvaluation = {
          score: Number(aiEval?.totalScore ?? 0),
          strengths: aiEval?.strengths || '',
          weaknesses: aiEval?.weaknesses || '',
          suggestions: aiEval?.suggestions || '',
          criteriaScores,
        }
        sub.aiGradedAt = new Date().toISOString()
        sub.aiError = undefined
        if (sub.status === 'submitted') sub.status = 'grading'

        // LƯU TRỰC TIẾP VÀO DATABASE SUPABASE POSTGRESQL QUA PRISMA
        try {
          let dbSubmission = await prisma.submission.findUnique({ where: { id: sub.id } })

          // Nếu chưa có trong DB (tồn tại từ memory store), tạo bản ghi submission trong DB
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
                model: 'gemini-2.5-flash',
                status: 'completed',
                suggestedScore: Number(aiEval?.totalScore ?? 0),
                strengths: aiEval?.strengths || '',
                weaknesses: aiEval?.weaknesses || '',
                suggestions: aiEval?.suggestions || '',
                resultJson: {
                  ...(aiEval as any),
                  submissionContent: sub.content || evalJson?.submissionContent || '',
                },
              },
              update: {
                provider: 'gemini',
                status: 'completed',
                suggestedScore: Number(aiEval?.totalScore ?? 0),
                strengths: aiEval?.strengths || '',
                weaknesses: aiEval?.weaknesses || '',
                suggestions: aiEval?.suggestions || '',
                resultJson: {
                  ...(aiEval as any),
                  submissionContent: sub.content || evalJson?.submissionContent || '',
                },
                errorMessage: null,
              },
            })

            await prisma.aICriterionScore.deleteMany({ where: { evaluationId: dbEval.id } }).catch(() => {})
            if (criteriaScores.length > 0) {
              await prisma.aICriterionScore.createMany({
                data: criteriaScores.map((c) => ({
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
                totalScore: Number(aiEval?.totalScore ?? 0),
              },
            }).catch(() => {})
          }
        } catch (dbErr) {
          console.warn('[BatchGrading] Lưu AI evaluation vào DB thất bại:', dbErr)
        }

        graded.push(sub.id)
      } catch (err: any) {
        sub.aiError = err?.message || 'AI chấm thất bại'
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
