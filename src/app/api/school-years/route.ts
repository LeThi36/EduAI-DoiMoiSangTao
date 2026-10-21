import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const dbSchoolYears = await prisma.schoolYear.findMany({
      orderBy: { startYear: 'desc' },
    })

    return NextResponse.json({ schoolYears: dbSchoolYears })
  } catch (err) {
    console.error('Lỗi đọc năm học từ DB:', err)
    return NextResponse.json({ error: 'Không thể đọc dữ liệu năm học từ cơ sở dữ liệu' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, startYear, endYear, isActive } = await request.json()

    if (!name || !startYear || !endYear) {
      return NextResponse.json({ error: 'Vui lòng điền đủ thông tin năm học' }, { status: 400 })
    }

    const sYear = Number(startYear)
    const eYear = Number(endYear)

    if (isActive) {
      await prisma.schoolYear.updateMany({
        data: { isActive: false },
      }).catch(() => {})
    }

    const created = await prisma.schoolYear.upsert({
      where: {
        startYear_endYear: { startYear: sYear, endYear: eYear },
      },
      update: { name, isActive: Boolean(isActive) },
      create: {
        name,
        startYear: sYear,
        endYear: eYear,
        isActive: Boolean(isActive),
        isArchived: false,
      },
    })

    return NextResponse.json({ message: 'Tạo năm học thành công', schoolYear: created }, { status: 201 })
  } catch (error) {
    console.error('School year error:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ' }, { status: 500 })
  }
}
