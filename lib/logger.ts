// Structured logging for prompts and command outputs (no PII)
// Logs operations and metadata without user-identifying information

interface LogEntry {
  timestamp: string
  endpoint: string
  operation: 'ai_request' | 'schema_update' | 'error'
  prompt?: string
  operationsCount?: number
  validOperationsCount?: number
  operations?: any[]
  componentCountBefore?: number
  componentCountAfter?: number
  error?: string
  durationMs?: number
  warnings?: string[]
}

/**
 * Sanitizes prompts to remove PII (Personally Identifiable Information)
 * Replaces emails, phone numbers, credit cards, SSNs, and other sensitive patterns
 */
export function sanitizePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') {
    return prompt
  }

  return prompt
    // Email addresses
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/gi, '[EMAIL]')
    // Phone numbers (various formats)
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
    .replace(/\b\(\d{3}\)\s?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
    .replace(/\b\d{10}\b/g, '[PHONE]')
    // Credit card numbers (16 digits, with or without separators)
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD]')
    // SSN (Social Security Numbers)
    .replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, '[SSN]')
    // IP addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
    // Common patterns that might contain names (conservative - only obvious patterns)
    // Note: We don't remove all names as they might be part of legitimate requests
    // (e.g., "make it look like Netflix" is fine)
}

export function logAIRequest(entry: Omit<LogEntry, 'timestamp' | 'endpoint' | 'operation'>) {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    endpoint: '/api/ai',
    operation: 'ai_request',
    ...entry,
    // Sanitize prompt to remove PII before logging
    ...(entry.prompt ? { prompt: sanitizePrompt(entry.prompt) } : {}),
  }
  
  // In production, send to logging service (e.g., Winston, Pino, CloudWatch)
  // For development, use structured console.log
  if (process.env.NODE_ENV === 'development') {
    console.log('[AI_REQUEST]', JSON.stringify(logEntry, null, 2))
  }
  // In production, you would send to your logging service here
}

export function logSchemaUpdate(entry: Omit<LogEntry, 'timestamp' | 'endpoint' | 'operation'>) {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    endpoint: '/api/schema',
    operation: 'schema_update',
    ...entry,
  }
  
  // In development, use structured console.log
  if (process.env.NODE_ENV === 'development') {
    console.log('[SCHEMA_UPDATE]', JSON.stringify(logEntry, null, 2))
  }
  // In production, you would send to your logging service here
}

export function logError(entry: Omit<LogEntry, 'timestamp' | 'operation'> & { endpoint?: string }) {
  const { endpoint, ...rest } = entry
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    endpoint: endpoint || 'unknown',
    operation: 'error',
    ...rest,
    // Sanitize prompt if present to remove PII before logging
    ...(rest.prompt ? { prompt: sanitizePrompt(rest.prompt) } : {}),
  }
  
  // Always log errors (both development and production)
  // In production, you would also send to error tracking service (e.g., Sentry)
  console.error('[ERROR]', JSON.stringify(logEntry, null, 2))
}
