import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { store } from '@/lib/data-store'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { finalScore, feedback, isPublished } = await request.json()

    // 1. Tìm hoặc tạo submission trong Prisma DB Supabase
    let dbSubmission = await prisma.submission.findUnique({
      where: { id },
      include: { assignment: true, student: true },
    }).catch(() => null)

    const memSub = store.submissions.find((s) => s.id === id)

    // Nếu bài nộp chưa có trong DB (tồn tại từ memory cache), đồng bộ vào DB
    if (!dbSubmission && memSub) {
      try {
        const dbStudent = await prisma.studentProfile.findFirst({
          where: {
            OR: [
              { userId: memSub.studentId },
              { id: memSub.studentId },
              { studentId: memSub.studentCode },
            ],
          },
        })
        const dbAssignment = await prisma.assignment.findFirst({
          where: {
            OR: [{ id: memSub.assignmentId }, { title: memSub.assignmentTitle }],
          },
        })

        if (dbStudent && dbAssignment) {
          dbSubmission = await prisma.submission.create({
            data: {
              id: memSub.id.startsWith('sub-') ? memSub.id : undefined,
              assignmentId: dbAssignment.id,
              studentId: dbStudent.id,
              attemptNumber: memSub.attemptNumber || 1,
              status: isPublished ? 'published' : 'reviewed',
              totalScore: Number(finalScore),
              submittedAt: new Date(memSub.submittedAt || Date.now()),
              ...(memSub.fileName || memSub.fileUrl
                ? {
                    files: {
                      create: {
                        fileName: memSub.fileName || 'file_nop_bai',
                        fileUrl: memSub.fileUrl || '',
                        fileType: memSub.fileName?.split('.').pop() || 'raw',
                        fileSize: 0,
                      },
                    },
                  }
                : {}),
            },
            include: { assignment: true, student: true },
          })
          memSub.id = dbSubmission.id
        }
      } catch (syncErr) {
        console.warn('Lỗi đồng bộ submission vào DB:', syncErr)
      }
    }

    // 2. Tìm giáo viên phụ trách để gắn vào Review
    const teacherProfile = await prisma.teacherProfile.findFirst().catch(() => null)

    const targetSubId = dbSubmission ? dbSubmission.id : id

    if (dbSubmission && teacherProfile) {
      await prisma.teacherReview.upsert({
        where: { submissionId: targetSubId },
        create: {
          submissionId: targetSubId,
          teacherId: teacherProfile.id,
          finalScore: Number(finalScore),
          finalFeedback: feedback || '',
          isPublished: Boolean(isPublished),
          reviewedAt: new Date(),
        },
        update: {
          finalScore: Number(finalScore),
          finalFeedback: feedback || '',
          isPublished: Boolean(isPublished),
          reviewedAt: new Date(),
        },
      })

      await prisma.submission.update({
        where: { id: targetSubId },
        data: {
          status: isPublished ? 'published' : 'reviewed',
          totalScore: Number(finalScore),
        },
      })
    }

    // 3. Đồng bộ vào memory store để các view hiện tại phản hồi tức thì
    if (memSub) {
      memSub.teacherReview = {
        finalScore: Number(finalScore),
        feedback: feedback || '',
        reviewedAt: new Date().toISOString(),
        isPublished: Boolean(isPublished),
      }
      memSub.status = isPublished ? 'published' : 'reviewed'
    }

    return NextResponse.json({
      message: isPublished ? 'Đã công bố điểm cho học sinh!' : 'Đã lưu bản duyệt điểm của giáo viên vào Database!',
      submission: memSub || dbSubmission,
    })
  } catch (error) {
    console.error('Teacher review error:', error)
    return NextResponse.json({ error: 'Lỗi duyệt bài' }, { status: 500 })
  }
}
