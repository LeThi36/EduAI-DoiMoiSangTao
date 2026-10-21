import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { store } from '@/lib/data-store'

/**
 * GET /api/teacher/student-insights?className=3/1
 * Per-student learning overview for a class, built from submissions
 * (quiz results + AI teacher insight).
 */
export async function GET(request: NextRequest) {
  const className = new URL(request.url).searchParams.get('className')

  try {
    // 1. Truy vấn học sinh và bài nộp từ Database Supabase PostgreSQL
    const dbStudents = await prisma.studentProfile.findMany({
      where: className
        ? { enrollments: { some: { class: { name: className } } } }
        : {},
      include: {
        user: true,
        enrollments: { include: { class: true } },
        submissions: {
          include: {
            assignment: true,
            aiEvaluation: true,
            teacherReview: true,
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    })

    if (dbStudents.length > 0) {
      const result = dbStudents.map((sp) => {
        const clsName = sp.enrollments[0]?.class?.name || className || ''
        const subs = sp.submissions

        const scored = subs
          .map((s) => s.teacherReview?.finalScore ?? s.totalScore ?? s.aiEvaluation?.suggestedScore)
          .filter((x): x is number => typeof x === 'number')

        const averageScore = scored.length
          ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
          : null

        const quizzes = subs
          .map((s) => (s.aiEvaluation?.resultJson as any)?.quizResult)
          .filter(Boolean)

        const totalQ = quizzes.reduce((a, q) => a + (q.totalQuestions || 0), 0)
        const correctQ = quizzes.reduce((a, q) => a + (q.correctCount || 0), 0)

        let trend: 'up' | 'down' | 'stable' | null = null
        if (scored.length >= 2) {
          const prevAvg = scored.slice(1).reduce((a, b) => a + b, 0) / (scored.length - 1)
          trend = scored[0] - prevAvg > 0.5 ? 'up' : prevAvg - scored[0] > 0.5 ? 'down' : 'stable'
        }

        return {
          studentId: sp.userId,
          studentCode: sp.studentId,
          fullName: sp.user.fullName,
          className: clsName,
          submissionCount: subs.length,
          averageScore,
          quizAccuracy: totalQ ? Math.round((correctQ / totalQ) * 100) : null,
          trend,
          weakConcepts: Array.from(new Set(quizzes.flatMap((q) => q.teacherInsight?.weakConcepts || []))).slice(0, 6),
          misconceptions: Array.from(new Set(quizzes.flatMap((q) => q.teacherInsight?.misconceptions || []))).slice(0, 6),
          timeline: subs.map((s) => {
            const qRes = (s.aiEvaluation?.resultJson as any)?.quizResult
            return {
              submissionId: s.id,
              assignmentTitle: s.assignment.title,
              submittedAt: s.submittedAt ? s.submittedAt.toISOString() : s.createdAt.toISOString(),
              score: s.teacherReview?.finalScore ?? s.totalScore ?? s.aiEvaluation?.suggestedScore ?? null,
              isQuiz: Boolean(qRes),
              correctCount: qRes?.correctCount,
              totalQuestions: qRes?.totalQuestions,
              insight: qRes?.teacherInsight ?? null,
            }
          }),
        }
      })

      return NextResponse.json({ students: result })
    }
  } catch (err) {
    console.warn('Lỗi đọc student-insights từ Prisma DB:', err)
  }

  // 2. Fallback memory store nếu DB chưa có
  const students = store.students.filter((s) => !className || s.className === className)

  const result = students.map((st) => {
    const subs = store.submissions
      .filter((s) => s.studentId === st.id)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())

    const scored = subs
      .map((s) => s.teacherReview?.finalScore ?? s.quizResult?.score ?? s.aiEvaluation?.score)
      .filter((x): x is number => typeof x === 'number')
    const averageScore = scored.length
      ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
      : null

    const quizzes = subs.filter((s) => s.quizResult)
    const totalQ = quizzes.reduce((a, s) => a + s.quizResult!.totalQuestions, 0)
    const correctQ = quizzes.reduce((a, s) => a + s.quizResult!.correctCount, 0)

    let trend: 'up' | 'down' | 'stable' | null = null
    if (scored.length >= 2) {
      const prevAvg = scored.slice(1).reduce((a, b) => a + b, 0) / (scored.length - 1)
      trend = scored[0] - prevAvg > 0.5 ? 'up' : prevAvg - scored[0] > 0.5 ? 'down' : 'stable'
    }

    return {
      studentId: st.id,
      studentCode: st.studentId,
      fullName: st.fullName,
      className: st.className,
      submissionCount: subs.length,
      averageScore,
      quizAccuracy: totalQ ? Math.round((correctQ / totalQ) * 100) : null,
      trend,
      weakConcepts: Array.from(new Set(quizzes.flatMap((s) => s.quizResult!.teacherInsight.weakConcepts))).slice(0, 6),
      misconceptions: Array.from(new Set(quizzes.flatMap((s) => s.quizResult!.teacherInsight.misconceptions))).slice(0, 6),
      timeline: subs.map((s) => ({
        submissionId: s.id,
        assignmentTitle: s.assignmentTitle,
        submittedAt: s.submittedAt,
        score: s.teacherReview?.finalScore ?? s.quizResult?.score ?? s.aiEvaluation?.score ?? null,
        isQuiz: Boolean(s.quizResult),
        correctCount: s.quizResult?.correctCount,
        totalQuestions: s.quizResult?.totalQuestions,
        insight: s.quizResult?.teacherInsight ?? null,
      })),
    }
  })

  return NextResponse.json({ students: result })
}
