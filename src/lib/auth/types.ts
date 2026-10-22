// Auth types - abstraction layer for authentication
export interface AuthUser {
  id: string
  email: string
  fullName?: string
}

export interface AuthResult {
  user: AuthUser | null
  error: string | null
  token?: string
}

export interface AuthSession {
  user: AuthUser
  accessToken: string
  refreshToken: string
}
