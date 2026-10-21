import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password.helper'

interface RawImportRow {
  fullName: string
  username: string
  password: string
}

export async function POST(request: NextRequest) {
  try {
    const { rows, classId } = await request.json()

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Dữ liệu nhập hàng loạt không hợp lệ hoặc rỗng' }, { status: 400 })
    }

    // 1. Tìm lớp trong DB
    const targetClass = classId
      ? await prisma.class.findFirst({
          where: {
            OR: [{ id: classId }, { code: classId }, { name: classId }],
          },
          include: { grade: true },
        })
      : null

    if (!targetClass) {
      return NextResponse.json({ error: 'Vui lòng chọn một lớp hợp lệ để nhập danh sách' }, { status: 400 })
    }

    // 2. Tìm hoặc tạo role student
    let role = await prisma.role.findUnique({ where: { name: 'student' } })
    if (!role) {
      role = await prisma.role.create({ data: { name: 'student' } })
    }

    const results = {
      imported: [] as unknown[],
      duplicates: [] as string[],
      errors: [] as string[],
    }

    for (const row of rows as RawImportRow[]) {
      if (!row.username || !row.fullName || !row.password) {
        results.errors.push(`Bỏ qua dòng thiếu thông tin: ${JSON.stringify(row)}`)
        continue
      }

      const loginName = String(row.username).trim().toLowerCase()

      // Kiểm tra trùng trong DB
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { username: loginName },
            { email: `${loginName}@school.edu.vn` },
            { studentProfile: { studentId: loginName } },
          ],
        },
      })

      if (existing) {
        results.duplicates.push(loginName)
        continue
      }

      const email = `${loginName}@school.edu.vn`
      const passwordHash = await hashPassword(String(row.password).trim())

      // Tạo User + StudentProfile + ClassEnrollment trong DB
      const createdUser = await prisma.user.create({
        data: {
          email,
          username: loginName,
          fullName: row.fullName.trim(),
          passwordHash,
          initialPassword: String(row.password).trim(),
          roleId: role.id,
          studentProfile: {
            create: {
              studentId: loginName,
            },
          },
        },
        include: { studentProfile: true },
      })

      if (createdUser.studentProfile) {
        await prisma.classEnrollment.upsert({
          where: {
            classId_studentId: {
              classId: targetClass.id,
              studentId: createdUser.studentProfile.id,
            },
          },
          update: {},
          create: {
            classId: targetClass.id,
            studentId: createdUser.studentProfile.id,
            status: 'active',
          },
        })
      }

      const newStudent = {
        id: createdUser.id,
        studentId: loginName,
        username: loginName,
        fullName: row.fullName.trim(),
        classId: targetClass.id,
        className: targetClass.name,
        gradeLevel: targetClass.grade?.level || Number(targetClass.name.split('/')[0]) || 3,
        schoolYearId: targetClass.schoolYearId,
        email,
        initialPassword: String(row.password).trim(),
        status: 'active' as const,
      }

      results.imported.push(newStudent)
    }

    return NextResponse.json({
      message: `Nhập thành công ${results.imported.length} học sinh vào cơ sở dữ liệu. Phát hiện ${results.duplicates.length} tên đăng nhập trùng.`,
      results,
    })
  } catch (error) {
    console.error('Batch import error:', error)
    return NextResponse.json({ error: 'Lỗi khi xử lý danh sách nhập khẩu' }, { status: 500 })
  }
}
