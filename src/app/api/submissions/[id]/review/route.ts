import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { finalScore, feedback, isPublished } = await request.json()

    // 1. Tìm bài nộp trực tiếp trong Prisma DB Supabase
    const dbSubmission = await prisma.submission.findUnique({
      where: { id },
      include: { assignment: true, student: true },
    })

    if (!dbSubmission) {
      return NextResponse.json({ error: 'Không tìm thấy bài nộp trong cơ sở dữ liệu' }, { status: 404 })
    }

    // 2. Tìm giáo viên phụ trách để gắn vào Review
    const teacherProfile = await prisma.teacherProfile.findFirst()
    if (!teacherProfile) {
      return NextResponse.json({ error: 'Không tìm thấy thông tin giáo viên để lưu đánh giá' }, { status: 400 })
    }

    // 3. Lưu hoặc cập nhật kết quả duyệt điểm vào DB
    await prisma.teacherReview.upsert({
      where: { submissionId: dbSubmission.id },
      create: {
        submissionId: dbSubmission.id,
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

    const updatedSubmission = await prisma.submission.update({
      where: { id: dbSubmission.id },
      data: {
        status: isPublished ? 'published' : 'reviewed',
        totalScore: Number(finalScore),
      },
      include: {
        assignment: true,
        student: { include: { user: true } },
        teacherReview: true,
        aiEvaluation: true,
      },
    })

    return NextResponse.json({
      message: isPublished ? 'Đã công bố điểm cho học sinh!' : 'Đã lưu bản duyệt điểm của giáo viên vào Database!',
      submission: updatedSubmission,
    })
  } catch (error) {
    console.error('Teacher review error:', error)
    return NextResponse.json({ error: 'Lỗi duyệt bài khi lưu vào cơ sở dữ liệu' }, { status: 500 })
  }
}
