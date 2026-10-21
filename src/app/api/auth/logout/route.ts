import { NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/server'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = await cookies()

    // 1. Delete EduAI cookies
    cookieStore.delete('eduai_session')
    cookieStore.delete('eduai_demo_session')

    // 2. Clear any Supabase cookies
    const allCookies = cookieStore.getAll()
    for (const c of allCookies) {
      if (c.name.startsWith('sb-') || c.name.includes('supabase') || c.name.includes('auth')) {
        cookieStore.delete(c.name)
      }
    }

    // 3. Delegate to AuthService signOut
    await AuthService.signOut()

    // 4. Return response with explicit cookie deletion headers
    const response = NextResponse.json({ message: 'Đăng xuất thành công' })
    response.cookies.delete('eduai_session')
    response.cookies.delete('eduai_demo_session')

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Lỗi đăng xuất' }, { status: 500 })
  }
}
