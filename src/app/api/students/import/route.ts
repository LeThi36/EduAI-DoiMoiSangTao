import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/data-store'
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

    const targetClass = classId ? store.classes.find((c) => c.id === classId) : null
    if (!targetClass) {
      return NextResponse.json({ error: 'Vui lòng chọn một lớp hợp lệ để nhập danh sách' }, { status: 400 })
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

      const loginName = row.username.trim().toLowerCase()
      const existing = store.students.find(
        (s) => (s.username || s.studentId).trim().toLowerCase() === loginName
      )
      if (existing) {
        results.duplicates.push(loginName)
        continue
      }

      const email = `${loginName}@school.edu.vn`
      const passwordHash = await hashPassword(row.password.trim())

      const newStudent = {
        id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: loginName,
        username: loginName,
        fullName: row.fullName.trim(),
        classId: targetClass.id,
        className: targetClass.name,
        gradeLevel: Number(targetClass.name.split('/')[0]) || 3,
        schoolYearId: targetClass.schoolYearId,
        email,
        passwordHash,
        initialPassword: row.password.trim(),
        status: 'active' as const,
      }

      store.students.push(newStudent)
      targetClass.studentCount += 1
      results.imported.push(newStudent)
    }

    return NextResponse.json({
      message: `Nhập thành công ${results.imported.length} học sinh. Phát hiện ${results.duplicates.length} tên đăng nhập trùng.`,
      results,
    })
  } catch (error) {
    console.error('Batch import error:', error)
    return NextResponse.json({ error: 'Lỗi khi xử lý danh sách nhập khẩu' }, { status: 500 })
  }
}
