import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { store } from '@/lib/data-store'
import { QuizFeedbackService } from '@/lib/ai/services/quiz-feedback.service'
import type { QuizItemResult, QuizResult, SubmissionItem } from '@/lib/data-store'

import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const assignmentId = searchParams.get('assignmentId')
  const studentId = searchParams.get('studentId')
  const status = searchParams.get('status')

  // 1. Đọc trực tiếp từ Database Supabase PostgreSQL qua Prisma
  try {
    const dbSubs = await prisma.submission.findMany({
      where: {
        ...(assignmentId
          ? {
              OR: [{ assignmentId }, { assignment: { title: assignmentId } }],
            }
          : {}),
        ...(studentId
          ? {
              OR: [
                { studentId },
                { student: { id: studentId } },
                { student: { userId: studentId } },
                { student: { studentId: studentId } },
              ],
            }
          : {}),
        ...(status ? { status } : {}),
      },
      include: {
        assignment: true,
        student: {
          include: {
            user: true,
            enrollments: {
              include: {
                class: true,
              },
            },
          },
        },
        files: true,
        answers: true,
        aiEvaluation: {
          include: {
            criterionScores: true,
          },
        },
        teacherReview: true,
      },
      orderBy: { submittedAt: 'desc' },
    })

    if (dbSubs.length > 0) {
      const dbFormatted: SubmissionItem[] = dbSubs.map((s) => {
        const file = s.files[0]
        const evalJson = s.aiEvaluation?.resultJson as any
        const quizRes = evalJson?.quizResult

        return {
          id: s.id,
          assignmentId: s.assignmentId,
          assignmentTitle: s.assignment?.title || '',
          studentId: s.student?.userId || s.studentId,
          studentProfileId: s.studentId,
          studentName: s.student?.user?.fullName || 'Học sinh',
          studentCode: s.student?.studentId || '',
          classId: s.student?.enrollments?.[0]?.class?.id || '',
          className: s.student?.enrollments?.[0]?.class?.name || '',
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
          answers: s.answers.map((a) => ({
            questionId: a.questionId,
            text: a.answer,
            score: a.score ?? undefined,
            isCorrect: a.isCorrect ?? undefined,
          })),
          quizResult: quizRes,
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
        }
      })

      return NextResponse.json({ submissions: dbFormatted })
    }
  } catch (err) {
    console.warn('Lỗi đọc submissions từ Prisma DB, dùng fallback memory:', err)
  }

  // 2. Fallback memory store nếu DB chưa có bản ghi
  let submissions = store.submissions
  if (assignmentId) {
    submissions = submissions.filter((s) => s.assignmentId === assignmentId)
  }
  if (studentId) {
    submissions = submissions.filter((s) => s.studentId === studentId)
  }
  if (status) {
    submissions = submissions.filter((s) => s.status === status)
  }

  return NextResponse.json({ submissions })
}

type IncomingAnswer = { questionId: string; selectedLabel?: string; text?: string }

export async function POST(request: NextRequest) {
  try {
    const { assignmentId, studentId, content, fileName, fileUrl, answers, isAutoSubmitted } = await request.json()

    let assignment = store.assignments.find((a) => a.id === assignmentId || a.title === assignmentId)
    if (!assignment) {
      try {
        const dbA = await prisma.assignment.findFirst({
          where: { OR: [{ id: assignmentId }, { title: assignmentId }] },
          include: { questions: { include: { options: true } } },
        })
        if (dbA) {
          assignment = {
            id: dbA.id,
            title: dbA.title,
            description: dbA.description,
            type: dbA.type as any,
            gradeLevel: dbA.gradeLevel,
            maxScore: dbA.maxScore,
            targetClassIds: [],
            startDate: dbA.startDate?.toISOString() || '',
            dueDate: dbA.dueDate?.toISOString() || '',
            isPublished: dbA.isPublished,
            rubric: (dbA.rubric as any) || { criteria: [] },
            aiPrompt: dbA.aiPrompt,
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
      } catch {}
    }

    let student = store.students.find(
      (s) => s.id === studentId || s.studentId === studentId || s.username === studentId
    )
    if (!student) {
      try {
        const dbS = await prisma.studentProfile.findFirst({
          where: {
            OR: [
              { id: studentId },
              { studentId: studentId },
              { userId: studentId },
              { user: { username: studentId } },
            ],
          },
          include: { user: true, enrollments: { include: { class: true } } },
        })
        if (dbS) {
          const cls = dbS.enrollments[0]?.class
          student = {
            id: dbS.userId,
            studentId: dbS.studentId,
            username: dbS.user.username || dbS.studentId,
            fullName: dbS.user.fullName,
            classId: cls?.id || '',
            className: cls?.name || '',
            gradeLevel: cls?.name ? Number(cls.name.split('/')[0]) : 3,
            schoolYearId: cls?.schoolYearId || '',
            email: dbS.user.email,
            status: 'active',
          }
          store.students.push(student)
        }
      } catch {}
    }

    if (!assignment || !student) {
      return NextResponse.json({ error: 'Bài tập hoặc học sinh không hợp lệ. Vui lòng kiểm tra assignmentId và studentId.' }, { status: 400 })
    }

    // Check maximum attempts allowed by teacher
    const existingSubmissions = store.submissions.filter(
      (s) => s.assignmentId === assignmentId && s.studentId === studentId
    )
    if (
      assignment.maxAttempts &&
      assignment.maxAttempts > 0 &&
      existingSubmissions.length >= assignment.maxAttempts
    ) {
      return NextResponse.json(
        { error: `Em đã dùng hết số lần làm bài quy định (${existingSubmissions.length}/${assignment.maxAttempts} lần)` },
        { status: 400 }
      )
    }
    const attemptNumber = existingSubmissions.length + 1

    const questions = assignment.questions || []
    const incoming: IncomingAnswer[] = Array.isArray(answers) ? answers : []

    // ---- Multiple choice: auto-grade against teacher's answer key ----
    if (assignment.type === 'multiple_choice') {
      if (questions.length === 0) {
        return NextResponse.json({ error: 'Bài trắc nghiệm chưa có câu hỏi' }, { status: 400 })
      }
      const unanswered = questions.filter(
        (q) => !incoming.find((a) => a.questionId === q.id && a.selectedLabel)
      )
      // Only require all answers if not auto-submitted due to time expiration
      if (unanswered.length > 0 && !isAutoSubmitted) {
        return NextResponse.json(
          { error: `Em còn ${unanswered.length} câu chưa chọn đáp án` },
          { status: 400 }
        )
      }

      // 1. Instant grading against the teacher's answer key
      const gradedItems: QuizItemResult[] = questions.map((q, i) => {
        const ans = incoming.find((a) => a.questionId === q.id)
        const selectedLabel = ans?.selectedLabel
        const correct = q.options?.find((o) => o.isCorrect)
        const chosen = q.options?.find((o) => o.label === selectedLabel)
        const isCorrect = Boolean(selectedLabel && correct && correct.label === selectedLabel)
        const maxScore = q.maxScore || 1
        return {
          questionId: q.id,
          index: i + 1,
          content: q.content,
          selectedLabel: selectedLabel || 'Chưa chọn',
          selectedText: chosen?.text || (isAutoSubmitted ? '(Hết giờ chưa kịp chọn)' : 'Chưa trả lời'),
          correctLabel: correct?.label,
          correctText: correct?.text,
          isCorrect,
          score: isCorrect ? maxScore : 0,
          maxScore,
        }
      })
      const totalWeight = gradedItems.reduce((s, g) => s + g.maxScore, 0) || 1
      const earned = gradedItems.reduce((s, g) => s + g.score, 0)
      const score = Math.round((earned / totalWeight) * assignment.maxScore * 10) / 10
      const correctCount = gradedItems.filter((g) => g.isCorrect).length

      // 2. AI analysis (explanations for wrong answers, student feedback, teacher insight)
      const history = store.submissions
        .filter((s) => s.studentId === student.id && s.quizResult)
        .slice(0, 5)
        .map((s) => ({ title: s.assignmentTitle, score: s.quizResult!.score, maxScore: s.quizResult!.maxScore }))

      const analysis = await QuizFeedbackService.analyze({
        assignmentTitle: assignment.title,
        gradeLevel: assignment.gradeLevel,
        studentName: student.fullName,
        items: gradedItems,
        score,
        maxScore: assignment.maxScore,
        history,
      })

      const quizResult: QuizResult = {
        correctCount,
        totalQuestions: gradedItems.length,
        score,
        maxScore: assignment.maxScore,
        ...analysis,
      }
      const wrongItems = quizResult.items.filter((g) => !g.isCorrect)

      const sub: SubmissionItem = {
        id: `sub-${Date.now()}`,
        assignmentId,
        assignmentTitle: assignment.title,
        studentId: student.id,
        studentName: student.fullName,
        studentCode: student.studentId,
        classId: student.classId,
        className: student.className,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        attemptNumber,
        isAutoSubmitted: Boolean(isAutoSubmitted),
        content: gradedItems.map((g) => `Câu ${g.index}: ${g.selectedLabel}`).join('\n'),
        answers: gradedItems.map(({ questionId, selectedLabel, isCorrect }) => ({
          questionId,
          selectedLabel,
          isCorrect,
        })),
        quizResult,
        // Keep aiEvaluation populated so existing grading/progress views keep working
        aiEvaluation: {
          score,
          strengths:
            quizResult.teacherInsight.masteredConcepts.join('; ') ||
            `Trả lời đúng ${correctCount}/${gradedItems.length} câu.`,
          weaknesses:
            wrongItems.length === 0
              ? 'Không có câu sai.'
              : quizResult.teacherInsight.weakConcepts.join('; ') ||
                wrongItems.map((g) => `Câu ${g.index}`).join(', '),
          suggestions: quizResult.studentFeedback,
          criteriaScores: quizResult.items.map((g) => ({
            criterion: `Câu ${g.index}`,
            score: g.score,
            maxScore: g.maxScore,
            evidence: `Chọn ${g.selectedLabel}${g.isCorrect ? ' (đúng)' : ` (sai, đúng là ${g.correctLabel})`}`,
          })),
        },
      }
      // Lưu vào Database Supabase PostgreSQL qua Prisma
      try {
        const dbStudent = await prisma.studentProfile.findFirst({
          where: {
            OR: [
              { id: student.id },
              { studentId: student.studentId },
              { userId: student.id },
            ],
          },
        })
        const dbAssignment = await prisma.assignment.findFirst({
          where: {
            OR: [{ id: assignment.id }, { title: assignment.title }],
          },
        })
        if (dbStudent && dbAssignment) {
          const dbCreated = await prisma.submission.create({
            data: {
              assignmentId: dbAssignment.id,
              studentId: dbStudent.id,
              attemptNumber,
              status: 'submitted',
              totalScore: score,
              submittedAt: new Date(),
              aiEvaluation: {
                create: {
                  provider: 'gemini',
                  status: 'completed',
                  suggestedScore: score,
                  strengths:
                    quizResult.teacherInsight.masteredConcepts.join('; ') ||
                    `Trả lời đúng ${correctCount}/${gradedItems.length} câu.`,
                  weaknesses:
                    wrongItems.length === 0
                      ? 'Không có câu sai.'
                      : quizResult.teacherInsight.weakConcepts.join('; ') ||
                        wrongItems.map((g) => `Câu ${g.index}`).join(', '),
                  suggestions: quizResult.studentFeedback,
                  resultJson: JSON.parse(JSON.stringify({
                    quizResult,
                    submissionContent: gradedItems.map((g) => `Câu ${g.index}: ${g.selectedLabel}`).join('\n'),
                    isAutoSubmitted: Boolean(isAutoSubmitted),
                  })) as Prisma.InputJsonValue,
                  criterionScores: {
                    create: quizResult.items.map((g) => ({
                      criterionName: `Câu ${g.index}`,
                      maxScore: g.maxScore,
                      suggestedScore: g.score,
                      evidence: `Chọn ${g.selectedLabel}${g.isCorrect ? ' (đúng)' : ` (sai, đúng là ${g.correctLabel})`}`,
                    })),
                  },
                },
              },
            },
          })
          sub.id = dbCreated.id
        }
      } catch (dbErr) {
        console.warn('Lỗi lưu submission trắc nghiệm vào DB:', dbErr)
      }

      store.submissions.unshift(sub)
      return NextResponse.json({
        message: isAutoSubmitted ? 'Hết giờ! Hệ thống đã tự động nộp bài của em.' : 'Nộp bài thành công',
        submission: sub,
      }, { status: 201 })
    }

    // ---- Essay: answer per question; Practice: free text + file ----
    let finalContent: string = content || ''
    let storedAnswers: import('@/lib/data-store').SubmissionItem['answers']
    if (assignment.type === 'essay') {
      const filled = questions.map((q) => ({
        questionId: q.id,
        text: (incoming.find((a) => a.questionId === q.id)?.text || '').trim(),
        content: q.content,
      }))
      if (filled.length > 0 && filled.some((f) => !f.text) && !isAutoSubmitted) {
        return NextResponse.json({ error: 'Em cần trả lời tất cả câu hỏi tự luận' }, { status: 400 })
      }
      storedAnswers = filled.map(({ questionId, text }) => ({ questionId, text }))
      if (filled.length > 0) {
        finalContent = filled
          .map((f, i) => `Câu hỏi ${i + 1}: ${f.content}\nTrả lời: ${f.text || (isAutoSubmitted ? '(Hết giờ - chưa kịp nhập câu trả lời)' : '')}`)
          .join('\n\n')
      }
    }

    if (!finalContent.trim() && !fileName) {
      if (isAutoSubmitted) {
        finalContent = '(Hết giờ làm bài - hệ thống tự động nộp bài làm hiện tại)'
      } else {
        return NextResponse.json({ error: 'Em cần nhập bài làm hoặc đính kèm tệp' }, { status: 400 })
      }
    }

    const newSub: import('@/lib/data-store').SubmissionItem = {
      id: `sub-${Date.now()}`,
      assignmentId,
      assignmentTitle: assignment.title,
      studentId: student.id,
      studentName: student.fullName,
      studentCode: student.studentId,
      classId: student.classId,
      className: student.className,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      attemptNumber,
      isAutoSubmitted: Boolean(isAutoSubmitted),
      content: finalContent,
      fileName: fileName || '',
      fileUrl: fileUrl || '',
      answers: storedAnswers,
    }

    // Lưu bài thực hành / tự luận trực tiếp vào Supabase PostgreSQL qua Prisma
    try {
      const dbStudent = await prisma.studentProfile.findFirst({
        where: {
          OR: [
            { id: student.id },
            { studentId: student.studentId },
            { userId: student.id },
          ],
        },
      })
      const dbAssignment = await prisma.assignment.findFirst({
        where: {
          OR: [{ id: assignment.id }, { title: assignment.title }],
        },
      })
      if (dbStudent && dbAssignment) {
        const dbCreated = await prisma.submission.create({
          data: {
            assignmentId: dbAssignment.id,
            studentId: dbStudent.id,
            attemptNumber,
            status: 'submitted',
            submittedAt: new Date(),
            aiEvaluation: {
              create: {
                provider: 'gemini',
                status: 'pending',
                resultJson: {
                  submissionContent: finalContent || '',
                  isAutoSubmitted: Boolean(isAutoSubmitted),
                },
              },
            },
            ...(fileName || fileUrl
              ? {
                  files: {
                    create: {
                      fileName: fileName || 'file_nop_bai',
                      fileUrl: fileUrl || '',
                      fileType: fileName?.split('.').pop() || 'raw',
                      fileSize: 0,
                    },
                  },
                }
              : {}),
            ...(storedAnswers && storedAnswers.length > 0
              ? {
                  answers: {
                    create: storedAnswers.map((a) => ({
                      questionId: a.questionId,
                      answer: a.text || '',
                    })),
                  },
                }
              : {}),
          },
        })
        newSub.id = dbCreated.id
      }
    } catch (dbErr) {
      console.warn('Lỗi lưu submission thực hành vào DB:', dbErr)
    }

    store.submissions.unshift(newSub)

    return NextResponse.json({ message: 'Nộp bài thành công', submission: newSub }, { status: 201 })
  } catch (error) {
    console.error('Submission error:', error)
    return NextResponse.json({ error: 'Lỗi nộp bài' }, { status: 500 })
  }
}
