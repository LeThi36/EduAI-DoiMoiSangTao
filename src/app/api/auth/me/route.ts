import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await AuthService.getCurrentUserWithRole()

    if (!user) {
      return NextResponse.json(
        { error: 'Chưa đăng nhập.' },
        { status: 401 }
      )
    }

    let studentInfo = null
    if (user.roleName === 'student') {
      try {
        const dbStudent = await prisma.studentProfile.findFirst({
          where: {
            OR: [
              ...(user.studentProfileId ? [{ id: user.studentProfileId }] : []),
              { userId: user.id },
              ...(user.email ? [{ user: { email: user.email } }] : []),
            ],
          },
          include: {
            user: true,
            enrollments: {
              include: { class: true },
            },
          },
        })

        if (dbStudent) {
          const cls = dbStudent.enrollments[0]?.class
          studentInfo = {
            id: dbStudent.userId,
            studentProfileId: dbStudent.id,
            studentId: dbStudent.studentId,
            fullName: dbStudent.user.fullName,
            classId: cls?.id || '',
            className: cls?.name || '',
            gradeLevel: cls?.name ? Number(cls.name.split('/')[0]) : 3,
          }
        }
      } catch (err) {
        console.warn('Lỗi đọc studentInfo từ Prisma DB trong auth/me:', err)
      }
    }

    return NextResponse.json({
      user: {
        id: studentInfo?.id || user.id,
        authId: user.authId,
        email: user.email,
        fullName: studentInfo?.fullName || user.fullName,
        roleId: user.roleId,
        roleName: user.roleName,
        isActive: user.isActive,
        teacherProfileId: user.teacherProfileId,
        studentProfileId: user.studentProfileId,
        studentInfo,
      },
    })
  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      { error: 'Lỗi hệ thống.' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await AuthService.getCurrentUserWithRole()
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
    }

    const body = await request.json()
    const { fullName } = body

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json({ error: 'Họ và tên không được để trống.' }, { status: 400 })
    }

    const trimmedName = fullName.trim()

    // Cập nhật trực tiếp vào cơ sở dữ liệu Prisma PostgreSQL
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { fullName: trimmedName },
    })

    return NextResponse.json({
      message: 'Cập nhật thông tin thành công.',
      user: {
        ...user,
        fullName: updated.fullName,
      },
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi cập nhật thông tin.' }, { status: 500 })
  }
}
