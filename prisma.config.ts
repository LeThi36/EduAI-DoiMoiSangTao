import { defineConfig } from '@prisma/config'

// Load environment variables from .env
try {
  process.loadEnvFile?.('.env')
} catch {}

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!dbUrl) {
  throw new Error('Biến môi trường DATABASE_URL hoặc DIRECT_URL chưa được thiết lập trong file .env')
}

export default defineConfig({
  datasource: {
    url: dbUrl,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
