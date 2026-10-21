import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email là bắt buộc.' },
        { status: 400 }
      )
    }

    const result = await AuthService.resetPassword(email)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'Email đặt lại mật khẩu đã được gửi thành công.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Lỗi hệ thống.' },
      { status: 500 }
    )
  }
}
