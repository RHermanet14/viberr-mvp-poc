import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if using a connection pooler (Supabase pooler uses port 6543)
// If so, append pgbouncer=true to disable prepared statements
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL
  if (!url) return url
  
  const isUsingPooler = url.includes(':6543') || url.includes('pooler')
  if (isUsingPooler && !url.includes('pgbouncer=true')) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}pgbouncer=true`
  }
  return url
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log queries in development
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error', 'warn'],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
