// Environment variable validation for production
// Validates required environment variables on startup

const requiredEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'GROQ_API_KEY',
] as const

export function validateEnvVars(): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }
  
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    console.error(`[ENV_VALIDATION] Missing required environment variables: ${missing.join(', ')}`)
    return { valid: false, missing }
  }
  
  return { valid: true, missing: [] }
}

// Validate on module load (only in production)
if (process.env.NODE_ENV === 'production') {
  const validation = validateEnvVars()
  if (!validation.valid) {
    throw new Error(`Missing required environment variables: ${validation.missing.join(', ')}`)
  }
}
