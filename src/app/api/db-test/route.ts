import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const roles = await prisma.role.findMany()
    const users = await prisma.user.findMany({ select: { id: true, email: true, fullName: true } })
    const classes = await prisma.class.findMany()
    const students = await prisma.studentProfile.findMany()

    return NextResponse.json({
      status: 'connected',
      message: 'Kết nối Supabase PostgreSQL thành công!',
      counts: {
        roles: roles.length,
        users: users.length,
        classes: classes.length,
        students: students.length,
      },
      roles,
      users,
      classes,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Không thể kết nối hoặc bảng chưa được tạo trên Supabase PostgreSQL.',
        error: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}
