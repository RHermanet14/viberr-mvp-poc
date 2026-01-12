'use client'

import { useEffect, useState, Component as ReactComponent, ErrorInfo, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { DesignSchema, Component as SchemaComponent, getDefaultSchema } from '@/lib/schema'
import { DataTable } from './DataTable'
import { DataChart } from './DataChart'
import { KPI } from './KPI'
import { TextComponent } from './TextComponent'
import { AIPrompt } from './AIPrompt'

interface ErrorBoundaryProps {
  children: ReactNode
  schema: DesignSchema
  previousSchema: DesignSchema | null
  onRollback: (schema: DesignSchema) => void
}

class ErrorBoundary extends ReactComponent<ErrorBoundaryProps, { hasError: boolean; error: Error | null }> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    // Roll back to previous schema
    if (this.props.previousSchema) {
      this.props.onRollback(this.props.previousSchema)
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when schema changes (rollback happened or new schema applied successfully)
    if (prevProps.schema !== this.props.schema) {
      if (this.state.hasError) {
        // Schema changed after error - reset error state
        this.setState({ hasError: false, error: null })
      }
      // If schema changed and no error, the new schema rendered successfully
      // We could update previousSchema here, but it's safer to keep the backup
      // until user makes another change
    }
  }

  render() {
    if (this.state.hasError) {
      // Determine text color for error styling based on background
      const bg = this.props.schema.theme.backgroundColor || (this.props.schema.theme.mode === 'dark' ? '#1a1a1a' : '#ffffff')
      const isDarkBg = bg.toLowerCase().startsWith('#') 
        ? parseInt(bg.slice(1, 3) || '00', 16) + parseInt(bg.slice(3, 5) || '00', 16) + parseInt(bg.slice(5, 7) || '00', 16) < 384
        : bg.includes('dark') || bg.includes('black') || bg.includes('#000')
      const textColor = isDarkBg ? '#ffffff' : '#000000'
      
      return (
        <div 
          className="p-4 rounded-lg border-2"
          style={{
            backgroundColor: textColor === '#ffffff' ? '#7f1d1d' : '#fee2e2',
            borderColor: textColor === '#ffffff' ? '#991b1b' : '#fecaca',
            color: textColor === '#ffffff' ? '#fecaca' : '#991b1b',
          }}
        >
          <strong>Runtime Error:</strong> {this.state.error?.message || 'An error occurred'}
          <p className="text-sm mt-1">The previous design has been restored.</p>
        </div>
      )
    }

    return this.props.children
  }
}

export function Dashboard() {
  const { data: session, status } = useSession()
  const [schema, setSchema] = useState<DesignSchema | null>(null)
  const [previousSchema, setPreviousSchema] = useState<DesignSchema | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      loadSchema()
    } else if (status === 'unauthenticated') {
      setLoading(false)
    }
    
    // Timeout fallback - if loading takes too long, stop loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout - stopping loading state')
        setLoading(false)
      }
    }, 10000) // 10 second timeout
    
    return () => clearTimeout(timeout)
  }, [status, loading])

  const loadSchema = async () => {
    try {
      const res = await fetch('/api/schema')
      if (res.ok) {
        const data = await res.json()
        setSchema(data)
        // Set initial previous schema as backup
        setPreviousSchema(JSON.parse(JSON.stringify(data)))
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to load schema:', errorData)
        setLoading(false)
      }
    } catch (error) {
      console.error('Failed to load schema:', error)
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const handleAIPrompt = async (prompt: string) => {
    if (!schema) return

    // Clear any previous errors
    setError(null)
    
    // Store current schema as backup before applying changes
    const currentSchemaBackup = JSON.parse(JSON.stringify(schema))
    setPreviousSchema(currentSchemaBackup)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, schema }),
      })

      if (res.ok) {
        const { schema: updatedSchema } = await res.json()
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:142',message:'API response received',data:{componentCount:updatedSchema.components?.length,componentIds:updatedSchema.components?.map((c:any)=>c.id),componentTypes:updatedSchema.components?.map((c:any)=>c.type)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // Apply new schema (previousSchema still has the backup)
        setSchema(updatedSchema)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:144',message:'setSchema called',data:{componentCount:updatedSchema.components?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // Note: previousSchema will be updated only after successful render
        // If runtime error occurs, ErrorBoundary will roll back to previousSchema
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to process AI prompt')
        // Roll back to backup
        setSchema(currentSchemaBackup)
      }
    } catch (error: any) {
      console.error('Failed to process AI prompt:', error)
      setError(error.message || 'Failed to process AI prompt')
      // Roll back to backup
      setSchema(currentSchemaBackup)
    }
  }

  const handleRestoreDefault = async () => {
    if (!schema) return

    // Clear any previous errors
    setError(null)
    
    // Store current schema as backup
    const currentSchemaBackup = JSON.parse(JSON.stringify(schema))
    setPreviousSchema(currentSchemaBackup)

    try {
      const defaultSchema = getDefaultSchema()
      
      // Save the default schema to the server
      const res = await fetch('/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultSchema),
      })

      if (res.ok) {
        // Apply default schema
        setSchema(defaultSchema)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to restore default schema')
        // Roll back to backup
        setSchema(currentSchemaBackup)
      }
    } catch (error: any) {
      console.error('Failed to restore default schema:', error)
      setError(error.message || 'Failed to restore default schema')
      // Roll back to backup
      setSchema(currentSchemaBackup)
    }
  }

  // #region agent log
  // Log schema changes - MUST be before any conditional returns (Rules of Hooks)
  useEffect(() => {
    if (schema) {
      fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:203',message:'Dashboard render with schema',data:{componentCount:schema.components.length,componentIds:schema.components.map(c=>c.id),componentTypes:schema.components.map(c=>c.type)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
  }, [schema]);
  // #endregion

  if (status === 'loading' || loading) {
    return <div className="p-8">Loading...</div>
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <a href="/auth/signin" className="text-blue-600 underline text-center">
          Sign in to continue
        </a>
      </div>
    )
  }

  if (!schema) {
    return <div className="p-8">Failed to load schema</div>
  }

  // Use custom backgroundColor if provided, otherwise fall back to mode-based colors
  const getBackgroundColor = () => {
    if (schema.theme.backgroundColor) {
      return schema.theme.backgroundColor
    }
    return schema.theme.mode === 'dark' ? '#1a1a1a' : '#ffffff'
  }

  // Use appropriate text color based on background
  const getTextColor = () => {
    if (schema.theme.backgroundColor) {
      // If custom background, use a contrasting text color
      // Simple heuristic: if background is dark, use light text
      const bg = schema.theme.backgroundColor.toLowerCase()
      const isDarkBg = bg.startsWith('#') 
        ? parseInt(bg.slice(1, 3), 16) + parseInt(bg.slice(3, 5), 16) + parseInt(bg.slice(5, 7), 16) < 384
        : bg.includes('dark') || bg.includes('black') || bg.includes('#000')
      return isDarkBg ? '#ffffff' : '#000000'
    }
    return schema.theme.mode === 'dark' ? '#ffffff' : '#000000'
  }

  const themeStyles = {
    backgroundColor: getBackgroundColor(),
    color: getTextColor(),
    fontSize: schema.theme.fontSize,
    fontFamily: schema.theme.fontFamily,
  }

  return (
    <div style={themeStyles} className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 
          className="text-3xl font-bold mb-6"
          style={{ color: getTextColor() }}
        >
          Personalized Dashboard
        </h1>
        
        {error && (
          <div 
            className="mb-4 p-4 rounded-lg border-2"
            style={{
              backgroundColor: schema.theme.backgroundColor 
                ? (getTextColor() === '#ffffff' ? '#7f1d1d' : '#fee2e2')
                : (schema.theme.mode === 'dark' ? '#7f1d1d' : '#fee2e2'),
              borderColor: schema.theme.backgroundColor
                ? (getTextColor() === '#ffffff' ? '#991b1b' : '#fecaca')
                : (schema.theme.mode === 'dark' ? '#991b1b' : '#fecaca'),
              color: schema.theme.backgroundColor
                ? (getTextColor() === '#ffffff' ? '#fecaca' : '#991b1b')
                : (schema.theme.mode === 'dark' ? '#fecaca' : '#991b1b'),
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <strong>Error:</strong> {error}
                <p className="text-sm mt-1">The previous design has been restored.</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-4 px-3 py-1 rounded"
                style={{
                  backgroundColor: schema.theme.mode === 'dark' ? '#991b1b' : '#fecaca',
                  color: schema.theme.mode === 'dark' ? '#fecaca' : '#991b1b',
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-4 mb-4">
          <AIPrompt onPrompt={handleAIPrompt} schema={schema} />
          <button
            onClick={handleRestoreDefault}
            className="px-4 py-2 rounded font-medium transition-colors"
            style={{
              backgroundColor: schema.theme.primaryColor || '#3b82f6',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
          >
            Restore Default
          </button>
        </div>

        <ErrorBoundary
          schema={schema}
          previousSchema={previousSchema}
          onRollback={(prevSchema) => {
            setSchema(prevSchema)
            setError('A runtime error occurred. The previous design has been restored.')
          }}
        >
          <div
            className="mt-8"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${schema.layout.columns}, 1fr)`,
              gap: `${schema.layout.gap}px`,
              gridAutoFlow: 'row',
            }}
          >
            {schema.components.map((component, index) => {
              // #region agent log
              const duplicateIds = schema.components.filter(c => c.id === component.id);
              fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:337',message:'Mapping component for render',data:{componentId:component.id,componentType:component.type,index,totalComponents:schema.components.length,duplicateCount:duplicateIds.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              return (
                <ComponentRenderer
                  key={component.id}
                  component={component}
                  schema={schema}
                  filters={schema.filters}
                  onError={(error) => {
                    setError(`Component error: ${error.message}. Rolling back to previous design.`)
                    if (previousSchema) {
                      setSchema(previousSchema)
                    }
                  }}
                />
              )
            })}
          </div>
        </ErrorBoundary>
      </div>
    </div>
  )
}

function ComponentRenderer({
  component,
  schema,
  filters,
  onError,
}: {
  component: SchemaComponent
  schema: DesignSchema
  filters?: DesignSchema['filters']
  onError?: (error: Error) => void
}) {
  // Merge component style with theme-aware defaults
  const style = {
    ...component.style,
    // If component doesn't have a color, use theme primary color
    color: component.style?.color || (component.type === 'chart' ? schema.theme.primaryColor : undefined),
    ...(component.position && {
      // Use grid positioning: if x/y are explicitly set, use absolute positioning
      // Otherwise, just use span for sizing and let grid auto-flow handle placement
      ...(component.position.x !== undefined && component.position.y !== undefined ? {
        gridColumnStart: component.position.x + 1, // CSS Grid is 1-indexed
        gridRowStart: component.position.y + 1,
        gridColumnEnd: `span ${component.position.width || 1}`,
        gridRowEnd: `span ${component.position.height || 1}`,
      } : {
        // No explicit position - just set span for sizing, let grid auto-flow place it
        gridColumn: `span ${component.position.width || 1}`,
        gridRow: `span ${component.position.height || 1}`,
      }),
    }),
  }

  // Create enhanced component with theme color if not specified
  const enhancedComponent = {
    ...component,
    style: {
      ...style,
      // For charts, if no color specified, use theme primary color
      color: component.style?.color || (component.type === 'chart' ? schema.theme.primaryColor : component.style?.color),
    },
  }

  // Wrap component rendering in error boundary
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:379',message:'ComponentRenderer switch entry',data:{componentId:component.id,componentType:component.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    switch (component.type) {
      case 'table':
        return (
          <div style={style}>
            <DataTable component={enhancedComponent} filters={filters} theme={schema.theme} />
          </div>
        )
      case 'chart':
      case 'pie_chart':
      case 'bar_chart':
      case 'line_chart':
      case 'area_chart':
      case 'scatter_chart':
      case 'radar_chart':
      case 'histogram':
      case 'composed_chart':
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.tsx:396',message:'Chart case matched, rendering DataChart',data:{componentId:component.id,componentType:component.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return (
          <div style={style}>
            <DataChart component={enhancedComponent} />
          </div>
        )
      case 'kpi':
        return (
          <div style={style}>
            <KPI component={enhancedComponent} />
          </div>
        )
      case 'text':
        return (
          <div style={style}>
            <TextComponent component={enhancedComponent} />
          </div>
        )
      default:
        return null
    }
  } catch (error: any) {
    // If component rendering fails, notify parent to roll back
    if (onError) {
      onError(error)
    }
    return (
      <div 
        className="p-4 border rounded-lg"
        style={{
          borderColor: '#ef4444',
          backgroundColor: schema.theme.mode === 'dark' ? '#7f1d1d' : '#fee2e2',
          color: schema.theme.mode === 'dark' ? '#fecaca' : '#991b1b',
        }}
      >
        <strong>Component Error:</strong> {error.message || 'Failed to render component'}
      </div>
    )
  }
}
