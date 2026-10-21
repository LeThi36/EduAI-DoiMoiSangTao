import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { store } from '@/lib/data-store'
import { hashPassword } from '@/lib/auth/password.helper'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  const gradeLevel = searchParams.get('gradeLevel')
  const query = searchParams.get('q')

  try {
    const dbStudents = await prisma.studentProfile.findMany({
      where: {
        ...(classId
          ? {
              enrollments: {
                some: { classId },
              },
            }
          : {}),
        ...(query
          ? {
              OR: [
                { studentId: { contains: query, mode: 'insensitive' } },
                { user: { fullName: { contains: query, mode: 'insensitive' } } },
                { user: { username: { contains: query, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        user: true,
        enrollments: {
          include: {
            class: {
              include: { grade: true },
            },
          },
        },
      },
      orderBy: { studentId: 'asc' },
    })

    if (dbStudents.length > 0) {
      const students = dbStudents
        .map((sp) => {
          const activeEnrollment = sp.enrollments[0]
          const cls = activeEnrollment?.class
          const gLevel = cls?.grade?.level || (cls?.name ? Number(cls.name.split('/')[0]) : 3)

          return {
            id: sp.userId,
            studentProfileId: sp.id,
            studentId: sp.studentId,
            username: sp.user.username || sp.studentId,
            fullName: sp.user.fullName,
            classId: cls?.id || '',
            className: cls?.name || '',
            gradeLevel: gLevel,
            schoolYearId: cls?.schoolYearId || '',
            email: sp.user.email,
            initialPassword: sp.user.initialPassword || '******',
            status: activeEnrollment?.status || 'active',
          }
        })
        .filter((s) => (gradeLevel ? s.gradeLevel === Number(gradeLevel) : true))

      return NextResponse.json({ students })
    }
  } catch (err) {
    console.warn('Lỗi đọc danh sách học sinh từ Prisma DB, dùng fallback:', err)
  }

  let students = store.students
  if (classId) {
    students = students.filter((s) => s.classId === classId)
  }
  if (gradeLevel) {
    students = students.filter((s) => s.gradeLevel === Number(gradeLevel))
  }
  if (query) {
    const q = query.toLowerCase()
    students = students.filter(
      (s) => s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q)
    )
  }

  return NextResponse.json({ students })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, username, password, initialPassword, fullName, classId, id } = body
    const rawPassword = password || initialPassword
    const loginName = String(username || studentId || '').trim().toLowerCase()

    if (!loginName || !fullName || !classId || !rawPassword) {
      return NextResponse.json({ error: 'Họ tên, tên đăng nhập, mật khẩu và lớp là bắt buộc' }, { status: 400 })
    }

    // 1. Tìm lớp học trong DB (hoặc fallback store)
    let targetClass = await prisma.class.findFirst({
      where: {
        OR: [{ id: classId }, { code: classId }, { name: classId }],
      },
      include: { grade: true },
    })

    const targetClassFromStore = store.classes.find(
      (c) => c.id === classId || c.name === classId || c.code === classId
    )

    if (!targetClass && !targetClassFromStore) {
      return NextResponse.json({ error: 'Lớp học không tồn tại. Vui lòng chọn hoặc tạo lớp học trước.' }, { status: 404 })
    }

    const resolvedClassId = targetClass?.id || targetClassFromStore?.id || classId
    const resolvedClassName = targetClass?.name || targetClassFromStore?.name || ''
    const resolvedSchoolYearId = targetClass?.schoolYearId || targetClassFromStore?.schoolYearId || ''
    const resolvedGradeLevel = targetClass?.grade?.level || 3

    // 2. Kiểm tra tên đăng nhập đã tồn tại trong DB chưa
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: loginName },
          { email: `${loginName}@school.edu.vn` },
          { studentProfile: { studentId: loginName } },
        ],
      },
    })

    if (existingUser) {
      return NextResponse.json({ error: `Tên đăng nhập ${loginName} đã tồn tại trong hệ thống` }, { status: 400 })
    }

    const email = `${loginName}@school.edu.vn`
    const passwordHash = await hashPassword(String(rawPassword))

    // 3. Lấy hoặc tạo role 'student'
    let role = await prisma.role.findUnique({ where: { name: 'student' } })
    if (!role) {
      role = await prisma.role.create({ data: { name: 'student' } })
    }

    // 4. Tạo User và StudentProfile
    const createdUser = await prisma.user.create({
      data: {
        ...(id ? { id } : {}),
        email,
        username: loginName,
        fullName,
        passwordHash,
        initialPassword: String(rawPassword),
        roleId: role.id,
        studentProfile: {
          create: {
            studentId: loginName,
          },
        },
      },
      include: { studentProfile: true },
    })

    // 5. Gán học sinh vào lớp (ClassEnrollment)
    if (createdUser.studentProfile) {
      await prisma.classEnrollment.upsert({
        where: {
          classId_studentId: {
            classId: resolvedClassId,
            studentId: createdUser.studentProfile.id,
          },
        },
        update: {},
        create: {
          classId: resolvedClassId,
          studentId: createdUser.studentProfile.id,
          status: 'active',
        },
      })
    }

    const newStudent = {
      id: createdUser.id,
      studentId: loginName,
      username: loginName,
      fullName,
      classId: resolvedClassId,
      className: resolvedClassName,
      gradeLevel: resolvedGradeLevel,
      schoolYearId: resolvedSchoolYearId,
      email,
      initialPassword: String(rawPassword),
      status: 'active' as const,
    }

    store.students.push(newStudent)

    return NextResponse.json(
      {
        message: 'Thêm học sinh và cấp tài khoản thành công',
        student: newStudent,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Create student error:', error)
    return NextResponse.json({ error: error?.message || 'Lỗi máy chủ khi tạo học sinh' }, { status: 500 })
  }
}
