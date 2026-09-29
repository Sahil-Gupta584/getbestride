import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './db/schema.js'
import { getSchemaName } from './db/schema.js'

const dbSchema = getSchemaName()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // honor ?schema= param like Prisma did (src/db.ts previously used PrismaPg adapter schema)
  ...(dbSchema !== 'public' ? { options: `-c search_path=${dbSchema}` } : {}),
})

declare global {
  var __pool: Pool | undefined
  var __db: ReturnType<typeof drizzle> | undefined
}

export const db = globalThis.__db || drizzle({ client: pool, schema })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pool = pool
  globalThis.__db = db
}

export { pool }
export * from './db/schema.js'
