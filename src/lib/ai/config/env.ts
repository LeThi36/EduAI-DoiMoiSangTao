// AI Configuration from environment variables (Server-side only)
export const AI_CONFIG = {
  provider: process.env.AI_PROVIDER_DEFAULT || 'gemini',
  gemini: {
    get apiKey(): string {
      const raw =
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GOOGLE_GEMINI_API_KEY ||
        ''
      return raw.trim().replace(/^["']|["']$/g, '')
    },
    get model(): string {
      const raw = (process.env.GEMINI_MODEL || '').trim().replace(/^["']|["']$/g, '')
      if (!raw || raw === 'gemini-1.5-flash' || raw === 'gemini-3.5-flash-lite') {
        return 'gemini-2.5-flash'
      }
      return raw
    },
    timeoutMs: 30000,
  },
}

