// Simple in-memory rate limiter for MVP
// In production, use Redis-based solution like @upstash/ratelimit

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of Array.from(rateLimitStore.entries())) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export function checkRateLimit(
  userId: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000 // 1 minute
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = userId
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    // New window or expired entry
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    }
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}
