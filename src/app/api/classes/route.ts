import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const schoolYearId = searchParams.get('schoolYearId')
  const gradeId = searchParams.get('gradeId')

  try {
    const dbClasses = await prisma.class.findMany({
      where: {
        ...(schoolYearId ? { schoolYearId } : {}),
        ...(gradeId ? { gradeId } : {}),
      },
      include: {
        teacher: {
          include: {
            user: { select: { fullName: true } },
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const classes = dbClasses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      schoolYearId: c.schoolYearId,
      gradeId: c.gradeId,
      teacherId: c.teacherId,
      teacherName: c.teacher?.user?.fullName || 'Giáo viên',
      studentCount: c._count.enrollments,
      isActive: c.isActive,
      isArchived: c.isArchived,
    }))

    return NextResponse.json({ classes })
  } catch (err) {
    console.error('Lỗi đọc lớp từ Prisma DB:', err)
    return NextResponse.json({ error: 'Không thể đọc dữ liệu lớp học từ cơ sở dữ liệu' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id, name, code, schoolYearId, gradeId } = await request.json()

    if (!name || !code || !schoolYearId || !gradeId) {
      return NextResponse.json({ error: 'Vui lòng cung cấp đầy đủ thông tin lớp' }, { status: 400 })
    }

    // Tìm giáo viên phụ trách (ưu tiên lấy giáo viên đầu tiên trong DB)
    let teacherProfile = await prisma.teacherProfile.findFirst({
      include: { user: true },
    })

    if (!teacherProfile) {
      return NextResponse.json({ error: 'Chưa có thông tin giáo viên trong hệ thống để gán lớp' }, { status: 400 })
    }

    const createdClass = await prisma.class.create({
      data: {
        ...(id ? { id } : {}),
        name,
        code,
        schoolYearId,
        gradeId,
        teacherId: teacherProfile.id,
        isActive: true,
        isArchived: false,
      },
    })

    const classData = {
      id: createdClass.id,
      name: createdClass.name,
      code: createdClass.code,
      schoolYearId: createdClass.schoolYearId,
      gradeId: createdClass.gradeId,
      teacherId: createdClass.teacherId,
      teacherName: teacherProfile.user?.fullName || 'Giáo viên',
      studentCount: 0,
      isActive: createdClass.isActive,
      isArchived: createdClass.isArchived,
    }

    return NextResponse.json({ message: 'Tạo lớp thành công', class: classData }, { status: 201 })
  } catch (error: any) {
    console.error('Create class error:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Mã lớp học đã tồn tại' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Lỗi máy chủ khi tạo lớp' }, { status: 500 })
  }
}
