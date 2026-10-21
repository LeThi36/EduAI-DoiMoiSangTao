/**
 * JSON Web Token (JWT) Helper
 * Chuẩn RFC 7519 (Header.Payload.Signature) sử dụng thuật toán HMAC-SHA256 (HS256).
 * Đảm bảo tương thích hoàn toàn cả Edge Middleware và Node.js runtime của Next.js.
 */

function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('Biến môi trường SESSION_SECRET chưa được thiết lập trong file .env')
  }
  return secret
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export interface JWTPayload {
  sub?: string // User ID
  id?: string
  authId?: string | null
  email?: string
  fullName?: string
  role?: string
  iat?: number // Issued at (seconds)
  exp?: number // Expiration (seconds)
  [key: string]: unknown
}

export interface JWTOptions {
  expiresInSeconds?: number
}

/**
 * Base64URL Encoding chuẩn RFC 4648
 */
export function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? textEncoder.encode(data) : data
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Base64URL Decoding chuẩn RFC 4648
 */
export function base64UrlDecode(str: string): Uint8Array {
  const padded = str.length % 4 === 0 ? str : str + '='.repeat(4 - (str.length % 4))
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Lấy CryptoKey HMAC-SHA256 từ secret
 */
async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(textEncoder.encode(getJwtSecret())),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/**
 * Ký tạo JSON Web Token (JWT) chuẩn RFC 7519
 * Cấu trúc: base64Url(Header) . base64Url(Payload) . base64Url(Signature)
 */
export async function signJWT(payload: JWTPayload, options?: JWTOptions): Promise<string> {
  const currentTime = Math.floor(Date.now() / 1000)
  const fullPayload: JWTPayload = {
    ...payload,
    iat: payload.iat ?? currentTime,
    exp: payload.exp ?? (options?.expiresInSeconds ? currentTime + options.expiresInSeconds : undefined),
  }

  // 1. Header chuẩn
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))

  // 2. Payload
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))

  // 3. Signature: HMAC-SHA256(header.payload)
  const dataToSign = `${encodedHeader}.${encodedPayload}`
  const key = await getSigningKey()
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, toArrayBuffer(textEncoder.encode(dataToSign)))
  const encodedSignature = base64UrlEncode(new Uint8Array(signatureBuffer))

  return `${dataToSign}.${encodedSignature}`
}

/**
 * Xác thực và giải mã token JWT
 * Kiểm tra chữ ký số HMAC-SHA256 và thời hạn sử dụng (exp)
 */
export async function verifyJWT<T extends JWTPayload = JWTPayload>(token: string | null | undefined): Promise<T | null> {
  if (!token || typeof token !== 'string') return null

  const parts = token.trim().split('.')
  if (parts.length !== 3) return null

  const [encodedHeader, encodedPayload, encodedSignature] = parts

  try {
    const dataToVerify = `${encodedHeader}.${encodedPayload}`
    const signatureBytes = base64UrlDecode(encodedSignature)
    const key = await getSigningKey()

    // 1. Kiểm tra chữ ký số
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(textEncoder.encode(dataToVerify))
    )

    if (!isValid) return null

    // 2. Phân tích Payload
    const payloadJson = textDecoder.decode(base64UrlDecode(encodedPayload))
    const payload = JSON.parse(payloadJson) as T

    // 3. Kiểm tra hạn sử dụng (exp)
    const currentTime = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < currentTime) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

/**
 * Giải mã nhanh payload của JWT (không verify chữ ký)
 */
export function decodeJWT<T extends JWTPayload = JWTPayload>(token: string): T | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadJson = textDecoder.decode(base64UrlDecode(parts[1]))
    return JSON.parse(payloadJson) as T
  } catch {
    return null
  }
}
