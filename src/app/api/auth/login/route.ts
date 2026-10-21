import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const identifier = String(body.account || body.username || body.email || '').trim()
    const password = String(body.password || '').trim()

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập tên tài khoản và mật khẩu.' },
        { status: 400 }
      )
    }

    const result = await AuthService.signIn(identifier, password)

    if (result.error || !result.user) {
      return NextResponse.json(
        { error: result.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu.' },
        { status: 401 }
      )
    }

    const roleName = result.role || 'teacher'
    const fullName = result.fullName || 'Người dùng'
    const redirectTo = roleName === 'student' ? '/student/dashboard' : '/dashboard'

    return NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName,
        roleName,
      },
      redirectTo,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Lỗi hệ thống khi đăng nhập. Vui lòng thử lại sau.' },
      { status: 500 }
    )
  }
}
