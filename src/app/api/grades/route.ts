import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { store } from '@/lib/data-store'

export async function GET() {
  try {
    const dbGrades = await prisma.grade.findMany({
      orderBy: { level: 'asc' },
    })

    if (dbGrades.length > 0) {
      return NextResponse.json({ grades: dbGrades })
    }
  } catch (err) {
    console.warn('Lỗi đọc khối lớp từ DB, dùng fallback:', err)
  }

  return NextResponse.json({ grades: store.grades })
}
