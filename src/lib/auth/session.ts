/**
 * Session Management
 * Quản lý phiên đăng nhập người dùng dựa trên JSON Web Token (JWT) và Cookie HttpOnly.
 * Hỗ trợ Sliding Window (làm mới phiên khi hoạt động) và Absolute Expiry (giới hạn cứng).
 */

import { signJWT, verifyJWT, JWTPayload } from './jwt.helper'

export const SESSION_COOKIE = 'eduai_session'

/** Tự động đăng xuất sau thời gian không hoạt động (mặc định 30 phút) */
export const SESSION_IDLE_SECONDS = Number(process.env.SESSION_IDLE_SECONDS) || 30 * 60

/** Giới hạn thời gian tối đa của 1 phiên làm việc kể từ lúc đăng nhập (mặc định 8 giờ) */
export const SESSION_ABSOLUTE_SECONDS = Number(process.env.SESSION_ABSOLUTE_SECONDS) || 8 * 60 * 60

export interface SessionUser {
  id: string
  authId?: string | null
  email: string
  fullName?: string
  role: string
}

export type SessionPayload = SessionUser & JWTPayload & {
  iat: number // Thời điểm tạo phiên (seconds)
  exp: number // Thời điểm hết hạn trượt (seconds)
}

const getCurrentTimeSeconds = () => Math.floor(Date.now() / 1000)

/**
 * Tạo token phiên đăng nhập (JWT) khi đăng nhập thành công
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const currentTime = getCurrentTimeSeconds()

  const payload: SessionPayload = {
    ...user,
    sub: user.id,
    iat: currentTime,
    exp: currentTime + SESSION_IDLE_SECONDS,
  }

  return signJWT(payload)
}

/**
 * Gia hạn phiên làm việc (Sliding Session) khi người dùng thao tác
 * Vẫn đảm bảo không vượt quá giới hạn tuyệt đối (SESSION_ABSOLUTE_SECONDS)
 */
export async function refreshSessionToken(payload: SessionPayload): Promise<string> {
  const currentTime = getCurrentTimeSeconds()

  // Không gia hạn nếu đã vượt quá thời gian phiên tuyệt đối tính từ lúc iat
  if (payload.iat && payload.iat + SESSION_ABSOLUTE_SECONDS < currentTime) {
    return ''
  }

  const refreshedPayload: SessionPayload = {
    ...payload,
    exp: currentTime + SESSION_IDLE_SECONDS,
  }

  return signJWT(refreshedPayload)
}

/**
 * Xác thực token phiên làm việc
 * Trả về thông tin SessionPayload nếu hợp lệ và chưa hết hạn, ngược lại trả về null
 */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null

  const payload = await verifyJWT<SessionPayload>(token)
  if (!payload) return null

  const currentTime = getCurrentTimeSeconds()

  // Kiểm tra giới hạn tuyệt đối kể từ lúc đăng nhập
  if (payload.iat && payload.iat + SESSION_ABSOLUTE_SECONDS < currentTime) {
    return null
  }

  return payload
}

/**
 * Cấu hình an toàn cho Cookie phiên làm việc
 */
export const sessionCookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_IDLE_SECONDS,
}
