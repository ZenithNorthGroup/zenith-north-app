import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/db/schema.ts',
  out:    './src/lib/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict:  true,
} satisfies Config
