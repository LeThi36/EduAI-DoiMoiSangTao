import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const dbGrades = await prisma.grade.findMany({
      orderBy: { level: 'asc' },
    })

    return NextResponse.json({ grades: dbGrades })
  } catch (err) {
    console.error('Lỗi đọc khối lớp từ DB:', err)
    return NextResponse.json({ error: 'Không thể đọc dữ liệu khối lớp từ cơ sở dữ liệu' }, { status: 500 })
  }
}
