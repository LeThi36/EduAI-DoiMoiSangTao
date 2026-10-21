/**
 * Password Hashing Helper
 * Chuẩn kiến trúc mật khẩu sử dụng Web Crypto PBKDF2 (SHA-256, 100.000 vòng lặp, salt ngẫu nhiên 16 bytes).
 * Đảm bảo an toàn theo khuyến nghị NIST, tương thích hoàn toàn môi trường Node.js và Edge runtime.
 */

const ITERATIONS = 100000
const KEY_LEN_BYTES = 32 // 256 bits
const HASH_PREFIX = 'pbkdf2$sha256'

const textEncoder = new TextEncoder()

/** Web Crypto requires data backed by an ArrayBuffer, not SharedArrayBuffer. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer as unknown as ArrayBuffer
}

/**
 * Chuyển đổi Uint8Array sang chuỗi Hex
 */
function toHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Chuyển đổi chuỗi Hex sang Uint8Array
 */
function fromHex(hex: string): Uint8Array {
  const match = hex.match(/.{1,2}/g) || []
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)))
}

/**
 * Băm mật khẩu với salt ngẫu nhiên bằng PBKDF2-HMAC-SHA256
 * @param plainPassword Mật khẩu thô (plaintext)
 * @returns Chuỗi định dạng: pbkdf2$sha256$100000$<salt_hex>$<hash_hex>
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword) {
    throw new Error('Mật khẩu không được để trống.')
  }

  // 1. Tạo salt ngẫu nhiên 16 bytes
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)

  // 2. Import mật khẩu thô vào Web Crypto Key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(textEncoder.encode(plainPassword)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  // 3. Thực hiện băm PBKDF2 với 100.000 vòng lặp
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt) as any,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    KEY_LEN_BYTES * 8
  )

  const hashBytes = new Uint8Array(derivedBits)
  return `${HASH_PREFIX}$${ITERATIONS}$${toHex(salt)}$${toHex(hashBytes)}`
}

/**
 * So khớp mật khẩu người dùng nhập vào với mật khẩu đã lưu
 * Tương thích cả mật khẩu đã băm (PBKDF2) và mật khẩu khởi tạo ban đầu (plaintext)
 * @param plainPassword Mật khẩu người dùng nhập
 * @param storedPasswordOrHash Mật khẩu đã băm hoặc mật khẩu lưu trong hệ thống
 */
export async function verifyPassword(plainPassword: string, storedPasswordOrHash?: string): Promise<boolean> {
  if (!plainPassword || !storedPasswordOrHash) {
    return false
  }

  // 1. Nếu là chuỗi hash PBKDF2 chuẩn
  if (storedPasswordOrHash.startsWith(HASH_PREFIX)) {
    const parts = storedPasswordOrHash.split('$')
    if (parts.length !== 5) return false

    const iterations = parseInt(parts[2], 10) || ITERATIONS
    const salt = fromHex(parts[3])
    const expectedHashHex = parts[4]

    const passwordKey = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(textEncoder.encode(plainPassword)),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: toArrayBuffer(salt) as any,
        iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      KEY_LEN_BYTES * 8
    )

    const computedHashHex = toHex(new Uint8Array(derivedBits))
    // So sánh chuỗi constant-time
    return timingSafeEqual(computedHashHex, expectedHashHex)
  }

  // 2. Tương thích mật khẩu khởi tạo ban đầu (plaintext fallback)
  return plainPassword === storedPasswordOrHash
}

/**
 * So sánh 2 chuỗi an toàn chống Timing Attack
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
