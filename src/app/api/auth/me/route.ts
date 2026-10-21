import { NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/server'
import { store } from '@/lib/data-store'

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

      if (!studentInfo) {
        const emailLower = (user.email || '').toLowerCase()
        const found = store.students.find(
          (s) =>
            s.id === user.id ||
            (s.email && s.email.toLowerCase() === emailLower) ||
            (s.username && s.username.toLowerCase() === emailLower.split('@')[0]) ||
            (s.studentId && s.studentId.toLowerCase() === emailLower.split('@')[0])
        )

        if (found) {
          studentInfo = {
            id: found.id,
            studentId: found.studentId,
            fullName: found.fullName,
            classId: found.classId,
            className: found.className,
            gradeLevel: found.gradeLevel,
          }
        }
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
