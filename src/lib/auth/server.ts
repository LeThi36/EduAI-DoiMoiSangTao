import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import type { AuthUser, AuthResult } from './types'
import { verifyPassword } from './password.helper'
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  sessionCookieOptions,
} from './session'

export const AuthService = {
  /**
   * Đăng nhập người dùng bằng tên tài khoản (username, studentId hoặc email) và mật khẩu.
   * Ưu tiên kiểm tra trực tiếp Database Supabase qua Prisma ORM.
   */
  async signIn(identifier: string, password: string): Promise<AuthResult & { role?: string; fullName?: string; token?: string }> {
    const cookieStore = await cookies()
    const rawId = (identifier || '').trim()
    const cleanId = rawId.toLowerCase()

    if (!cleanId || !password) {
      return {
        user: null,
        error: 'Vui lòng nhập tên tài khoản và mật khẩu.',
      }
    }

    let dbErrorOccurred = false

    // 1. Kiểm tra tài khoản trong Database Supabase PostgreSQL
    try {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: cleanId, mode: 'insensitive' } },
            { username: { equals: cleanId, mode: 'insensitive' } },
            { username: { equals: rawId, mode: 'insensitive' } },
            { studentProfile: { studentId: { equals: cleanId, mode: 'insensitive' } } },
            { studentProfile: { studentId: { equals: rawId, mode: 'insensitive' } } },
          ],
        },
        include: {
          role: true,
          teacherProfile: true,
          studentProfile: true,
        },
      })

      if (dbUser) {
        if (!dbUser.isActive) {
          return {
            user: null,
            error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
          }
        }

        const storedPassword = dbUser.passwordHash || dbUser.initialPassword || undefined
        const isValid = await verifyPassword(password, storedPassword)

        if (!isValid) {
          return {
            user: null,
            error: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.',
          }
        }

        const roleName = dbUser.role?.name || 'teacher'
        const sessionPayload = {
          id: dbUser.id,
          authId: dbUser.authId || `auth-${dbUser.id}`,
          email: dbUser.email,
          fullName: dbUser.fullName,
          role: roleName,
        }

        const token = await createSessionToken(sessionPayload)
        cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions)

        return {
          user: { id: dbUser.id, email: dbUser.email },
          role: roleName,
          fullName: dbUser.fullName,
          token,
          error: null,
        }
      }
    } catch (dbErr) {
      dbErrorOccurred = true
      console.error('Lỗi truy vấn Database khi đăng nhập:', dbErr)
    }

    // 2. Thử Supabase Auth (dành cho tài khoản xác thực qua Supabase Auth nếu có)
    const hasValidSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('paste_anon_key')

    if (hasValidSupabase) {
      try {
        const supabase = await createClient()
        const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password })
        if (!error && data.user) {
          const dbUser = await prisma.user.findUnique({
            where: { authId: data.user.id },
            include: { role: true },
          })

          const roleName = dbUser?.role?.name || 'teacher'
          const fullName = dbUser?.fullName || data.user.email || 'Người dùng'

          const sessionPayload = {
            id: dbUser?.id || data.user.id,
            authId: data.user.id,
            email: data.user.email ?? '',
            fullName,
            role: roleName,
          }

          const token = await createSessionToken(sessionPayload)
          cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions)

          return {
            user: { id: data.user.id, email: data.user.email ?? '' },
            role: roleName,
            fullName,
            token,
            error: null,
          }
        }
      } catch (err) {
        console.warn('Supabase auth attempt failed:', err)
      }
    }

    if (dbErrorOccurred && !hasValidSupabase) {
      return {
        user: null,
        error: 'Lỗi kết nối cơ sở dữ liệu. Vui lòng kiểm tra lại kết nối mạng hoặc liên hệ quản trị viên.',
      }
    }

    return {
      user: null,
      error: 'Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.',
    }
  },

  /**
   * Lấy thông tin người dùng đang đăng nhập từ Session Cookie JWT
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const cookieStore = await cookies()
    const parsed = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)

    if (parsed) {
      return { id: parsed.id, email: parsed.email, fullName: parsed.fullName }
    }

    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null
      return { id: user.id, email: user.email ?? '' }
    } catch {
      return null
    }
  },

  /**
   * Lấy thông tin người dùng kèm theo vai trò từ Database
   */
  async getCurrentUserWithRole() {
    const cookieStore = await cookies()
    const parsed = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)

    if (!parsed) {
      const authUser = await this.getCurrentUser()
      if (!authUser) return null
    }

    const userId = parsed?.id
    const userEmail = parsed?.email

    try {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(userId ? [{ id: userId }, { authId: userId }] : []),
            ...(userEmail ? [{ email: userEmail }] : []),
          ],
        },
        include: {
          role: true,
          teacherProfile: true,
          studentProfile: true,
        },
      })

      if (dbUser) {
        return {
          id: dbUser.id,
          authId: dbUser.authId || dbUser.id,
          email: dbUser.email,
          fullName: dbUser.fullName,
          roleId: dbUser.role.id,
          roleName: dbUser.role.name,
          isActive: dbUser.isActive,
          teacherProfileId: dbUser.teacherProfile?.id || null,
          studentProfileId: dbUser.studentProfile?.id || null,
        }
      }
    } catch (err) {
      console.warn('Lỗi khi lấy thông tin người dùng kèm vai trò:', err)
    }

    if (parsed) {
      return {
        id: parsed.id,
        authId: parsed.authId || parsed.id,
        email: parsed.email,
        fullName: parsed.fullName || 'Người dùng',
        roleId: parsed.role,
        roleName: parsed.role,
        isActive: true,
        teacherProfileId: parsed.role === 'teacher' ? 'default-teacher' : null,
        studentProfileId: parsed.role === 'student' ? 'default-student' : null,
      }
    }

    return null
  },

  /**
   * Đăng xuất người dùng và dọn sạch session cookies
   */
  async signOut(): Promise<{ error: string | null }> {
    try {
      const cookieStore = await cookies()
      cookieStore.delete(SESSION_COOKIE)
      cookieStore.delete('eduai_session')
      cookieStore.delete('eduai_demo_session')
    } catch {}

    try {
      const supabase = await createClient()
      await supabase.auth.signOut()
    } catch {}

    return { error: null }
  },

  async resetPassword(email: string): Promise<{ error: string | null }> {
    return { error: null }
  },

  async updatePassword(password: string): Promise<{ error: string | null }> {
    return { error: null }
  },
}
