// Structured logging for prompts and command outputs (no PII)
// Logs operations and metadata without user-identifying information

interface LogEntry {
  timestamp: string
  endpoint: string
  operation: 'ai_request' | 'schema_update' | 'error'
  prompt?: string
  operationsCount?: number
  operations?: any[]
  componentCountBefore?: number
  componentCountAfter?: number
  error?: string
  durationMs?: number
}

export function logAIRequest(entry: Omit<LogEntry, 'timestamp' | 'endpoint' | 'operation'>) {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    endpoint: '/api/ai',
    operation: 'ai_request',
    ...entry,
  }
  
  // In production, send to logging service (e.g., Winston, Pino, CloudWatch)
  // For MVP, use structured console.log
  console.log('[AI_REQUEST]', JSON.stringify(logEntry, null, 2))
}

export function logSchemaUpdate(entry: Omit<LogEntry, 'timestamp' | 'endpoint' | 'operation'>) {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    endpoint: '/api/schema',
    operation: 'schema_update',
    ...entry,
  }
  
  console.log('[SCHEMA_UPDATE]', JSON.stringify(logEntry, null, 2))
}

export function logError(entry: Omit<LogEntry, 'timestamp' | 'operation'> & { endpoint?: string }) {
  const { endpoint, ...rest } = entry
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    endpoint: endpoint || 'unknown',
    operation: 'error',
    ...rest,
  }
  
  console.error('[ERROR]', JSON.stringify(logEntry, null, 2))
}
