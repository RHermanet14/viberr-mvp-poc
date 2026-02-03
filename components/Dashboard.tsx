'use client'

import { useEffect, useState, Component as ReactComponent, ErrorInfo, ReactNode } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { DesignSchema, Component as SchemaComponent, getDefaultSchema, getBlankSchema, getDarkDefaultSchema, getDarkBlankSchema } from '@/lib/schema'
import { DataTable } from './DataTable'
import { DataChart } from './DataChart'
import { KPI } from './KPI'
import { TextComponent } from './TextComponent'
import { ImageComponent } from './ImageComponent'
import { AIPrompt } from './AIPrompt'
import { loadGoogleFont, extractFontNames } from '@/lib/fonts'

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

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    // Roll back to previous schema on error
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
  const [showControls, setShowControls] = useState(true)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      loadSchema()
    } else if (status === 'unauthenticated') {
      setLoading(false)
    }
    
    // Timeout fallback - if loading takes too long, stop loading
    const timeout = setTimeout(() => {
      if (loading) {
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
        setLoading(false)
      }
    } catch {
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const handleAIPrompt = async (prompt: string, images?: File[]) => {
    if (!schema) return

    // Clear any previous errors
    setError(null)
    
    // Store current schema as backup before applying changes
    const currentSchemaBackup = JSON.parse(JSON.stringify(schema))
    setPreviousSchema(currentSchemaBackup)

    try {
      // Convert images to base64 data URLs
      const imageDataUrls: string[] = []
      if (images && images.length > 0) {
        for (const image of images) {
          const reader = new FileReader()
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(image)
          })
          imageDataUrls.push(dataUrl)
        }
      }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          schema,
          images: imageDataUrls.length > 0 ? imageDataUrls : undefined,
        }),
      })

      if (res.ok) {
        const { schema: updatedSchema, warnings } = await res.json()
        setSchema(updatedSchema)
        
        // Display warnings to user if any
        if (warnings && warnings.length > 0) {
          setError(warnings.join(' '))
        }
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to process AI prompt')
        setSchema(currentSchemaBackup)
      }
    } catch (error: any) {
      setError(error.message || 'Failed to process AI prompt')
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
        setSchema(defaultSchema)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to restore default schema')
        setSchema(currentSchemaBackup)
      }
    } catch (error: any) {
      setError(error.message || 'Failed to restore default schema')
      setSchema(currentSchemaBackup)
    }
  }

  const handleBlankPreset = async () => {
    if (!schema) return

    // Clear any previous errors
    setError(null)
    
    // Store current schema as backup
    const currentSchemaBackup = JSON.parse(JSON.stringify(schema))
    setPreviousSchema(currentSchemaBackup)

    try {
      const blankSchema = getBlankSchema()
      
      // Save the blank schema to the server
      const res = await fetch('/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blankSchema),
      })

      if (res.ok) {
        setSchema(blankSchema)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to apply blank preset')
        setSchema(currentSchemaBackup)
      }
    } catch (error: any) {
      setError(error.message || 'Failed to apply blank preset')
      setSchema(currentSchemaBackup)
    }
  }

  const handleDarkDefaultPreset = async () => {
    if (!schema) return

    // Clear any previous errors
    setError(null)
    
    // Store current schema as backup
    const currentSchemaBackup = JSON.parse(JSON.stringify(schema))
    setPreviousSchema(currentSchemaBackup)

    try {
      const darkDefaultSchema = getDarkDefaultSchema()
      
      // Save the dark default schema to the server
      const res = await fetch('/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(darkDefaultSchema),
      })

      if (res.ok) {
        setSchema(darkDefaultSchema)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to apply dark default preset')
        setSchema(currentSchemaBackup)
      }
    } catch (error: any) {
      setError(error.message || 'Failed to apply dark default preset')
      setSchema(currentSchemaBackup)
    }
  }

  const handleDarkBlankPreset = async () => {
    if (!schema) return

    // Clear any previous errors
    setError(null)
    
    // Store current schema as backup
    const currentSchemaBackup = JSON.parse(JSON.stringify(schema))
    setPreviousSchema(currentSchemaBackup)

    try {
      const darkBlankSchema = getDarkBlankSchema()
      
      // Save the dark blank schema to the server
      const res = await fetch('/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(darkBlankSchema),
      })

      if (res.ok) {
        setSchema(darkBlankSchema)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to apply dark blank preset')
        setSchema(currentSchemaBackup)
      }
    } catch (error: any) {
      setError(error.message || 'Failed to apply dark blank preset')
      setSchema(currentSchemaBackup)
    }
  }

  // Load Google Fonts when schema changes
  useEffect(() => {
    if (schema) {
      const fontNames = extractFontNames(schema)
      fontNames.forEach(fontName => {
        loadGoogleFont(fontName)
      })
    }
  }, [schema])

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
    backgroundImage: schema.theme.backgroundImage,
    color: getTextColor(),
    fontSize: schema.theme.fontSize,
    fontFamily: schema.theme.fontFamily,
  }

  return (
    <div style={{...themeStyles, overflowX: 'hidden', maxWidth: '100vw'}} className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2" style={{overflowX: 'hidden', maxWidth: '100%'}}>
        <header 
          className="flex items-center justify-between py-4 mb-4"
          style={{
            borderBottom: `1px solid ${schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          }}
        >
          <div className="flex items-center gap-3">
            {/* Logo/Icon */}
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ 
                backgroundColor: schema.theme.primaryColor || '#3b82f6',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#ffffff" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <div>
              <h1 
                className="text-xl sm:text-2xl font-semibold tracking-tight"
                style={{ color: getTextColor() }}
              >
                Dashboard
              </h1>
              {session?.user?.email && (
                <p 
                  className="text-xs"
                  style={{ color: schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                >
                  {session.user.email}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Help Button */}
            <button
              onClick={() => setShowHelp(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={{
                backgroundColor: schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: getTextColor(),
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
              }}
              title="Help & Documentation"
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </button>
            
            {/* Toggle Controls Button */}
            <button
              onClick={() => setShowControls(!showControls)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={{
                backgroundColor: schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: getTextColor(),
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
              }}
              title={showControls ? 'Hide editor' : 'Show editor'}
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{
                  transform: showControls ? 'rotate(0deg)' : 'rotate(180deg)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
            
            {/* Logout Button */}
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={{
                backgroundColor: schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: getTextColor(),
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = schema.theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
              }}
              title="Sign out"
            >
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </header>
        
        {showControls && (
          <>
            {error && (
              <div 
                className="mb-3 p-3 rounded-lg border-2"
                style={{
                  backgroundColor: (error.includes('ignored') || error.includes('not added') || error.includes('Maximum'))
                    ? (schema.theme.backgroundColor 
                        ? (getTextColor() === '#ffffff' ? '#78350f' : '#fef3c7')
                        : (schema.theme.mode === 'dark' ? '#78350f' : '#fef3c7'))
                    : (schema.theme.backgroundColor 
                        ? (getTextColor() === '#ffffff' ? '#7f1d1d' : '#fee2e2')
                        : (schema.theme.mode === 'dark' ? '#7f1d1d' : '#fee2e2')),
                  borderColor: (error.includes('ignored') || error.includes('not added') || error.includes('Maximum'))
                    ? (schema.theme.backgroundColor
                        ? (getTextColor() === '#ffffff' ? '#92400e' : '#fde68a')
                        : (schema.theme.mode === 'dark' ? '#92400e' : '#fde68a'))
                    : (schema.theme.backgroundColor
                        ? (getTextColor() === '#ffffff' ? '#991b1b' : '#fecaca')
                        : (schema.theme.mode === 'dark' ? '#991b1b' : '#fecaca')),
                  color: (error.includes('ignored') || error.includes('not added') || error.includes('Maximum'))
                    ? (schema.theme.backgroundColor
                        ? (getTextColor() === '#ffffff' ? '#fde68a' : '#92400e')
                        : (schema.theme.mode === 'dark' ? '#fde68a' : '#92400e'))
                    : (schema.theme.backgroundColor
                        ? (getTextColor() === '#ffffff' ? '#fecaca' : '#991b1b')
                        : (schema.theme.mode === 'dark' ? '#fecaca' : '#991b1b')),
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <strong>{(error.includes('ignored') || error.includes('not added') || error.includes('Maximum')) ? '⚠️ Warning:' : 'Error:'}</strong> {error}
                    {!(error.includes('ignored') || error.includes('not added') || error.includes('Maximum')) && (
                      <p className="text-sm mt-1">The previous design has been restored.</p>
                    )}
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="ml-4 px-3 py-1 rounded"
                    style={{
                      backgroundColor: (error.includes('ignored') || error.includes('not added') || error.includes('Maximum'))
                        ? (schema.theme.mode === 'dark' ? '#92400e' : '#fde68a')
                        : (schema.theme.mode === 'dark' ? '#991b1b' : '#fecaca'),
                      color: (error.includes('ignored') || error.includes('not added') || error.includes('Maximum'))
                        ? (schema.theme.mode === 'dark' ? '#fde68a' : '#92400e')
                        : (schema.theme.mode === 'dark' ? '#fecaca' : '#991b1b'),
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
            
            <div className="mb-3">
              <AIPrompt onPrompt={handleAIPrompt} schema={schema} showExamples={false} />
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-xs flex-shrink-0" style={{ color: schema.theme.mode === 'dark' ? '#9ca3af' : '#6b7280' }}>
                  Examples: "Dark mode", "Bigger font", "Two columns", "Add pie chart", "Sort by price"
                </p>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <button
                    onClick={handleRestoreDefault}
                    className="px-3 py-1.5 rounded font-medium transition-colors text-sm whitespace-nowrap"
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
                    Default
                  </button>
                  <button
                    onClick={handleBlankPreset}
                    className="px-3 py-1.5 rounded font-medium transition-colors text-sm whitespace-nowrap"
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
                    Blank
                  </button>
                  <button
                    onClick={handleDarkDefaultPreset}
                    className="px-3 py-1.5 rounded font-medium transition-colors text-sm whitespace-nowrap"
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
                    Dark Default
                  </button>
                  <button
                    onClick={handleDarkBlankPreset}
                    className="px-3 py-1.5 rounded font-medium transition-colors text-sm whitespace-nowrap"
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
                    Dark Blank
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <ErrorBoundary
          schema={schema}
          previousSchema={previousSchema}
          onRollback={(prevSchema) => {
            setSchema(prevSchema)
            setError('A runtime error occurred. The previous design has been restored.')
          }}
        >
          <div
            className="pt-2"
            style={{
              display: 'grid',
              overflowX: 'hidden',
              maxWidth: '100%',
              gridTemplateColumns: `repeat(${schema.layout.columns}, 1fr)`,
              gap: `${schema.layout.gap}px`,
              gridAutoFlow: 'row',
            }}
          >
            {schema.components.map((component) => (
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
            ))}
          </div>
        </ErrorBoundary>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: getBackgroundColor(),
              color: getTextColor(),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Dashboard Help</h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-2xl font-bold px-2 hover:opacity-70"
                  style={{ color: getTextColor() }}
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                <section>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: schema.theme.primaryColor }}>
                    Components
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li><strong>Table:</strong> Display data in rows and columns. Example: "show only title and price"</li>
                    <li><strong>Chart:</strong> Visualize data with line, bar, pie, area, scatter, radar charts. Example: "add bar chart by month"</li>
                    <li><strong>KPI:</strong> Show key metrics like totals, averages, counts. Example: "add total items KPI"</li>
                    <li><strong>Text:</strong> Add headings, titles, or descriptions. Example: "add text saying 'Sales Report'"</li>
                    <li><strong>Image:</strong> Display images with a URL. Example: "add image with url https://example.com/logo.png"</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: schema.theme.primaryColor }}>
                    Styling Operations
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li><strong>Theme:</strong> "dark mode", "light mode", "make it like Netflix/Spotify"</li>
                    <li><strong>Colors:</strong> "blue background", "red text", "make table text orange"</li>
                    <li><strong>Typography:</strong> "bigger font", "gothic font", "elegant font"</li>
                    <li><strong>Layout:</strong> "two columns", "three columns", "bigger gap"</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: schema.theme.primaryColor }}>
                    Data Operations
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li><strong>Sorting:</strong> "sort by price", "order by date descending"</li>
                    <li><strong>Filtering:</strong> "show top 10", "show only 5 items"</li>
                    <li><strong>Columns:</strong> "table only show title and price"</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: schema.theme.primaryColor }}>
                    Layout Operations
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li><strong>Reorder:</strong> "move chart to top", "put KPIs at the beginning"</li>
                    <li><strong>Remove:</strong> "remove the chart", "delete table"</li>
                    <li><strong>Add:</strong> "add pie chart by category", "add KPIs at top"</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: schema.theme.primaryColor }}>
                    Image Upload
                  </h3>
                  <p className="text-sm">
                    Click the "Upload" button or drag & drop an image to replicate its style on your dashboard. 
                    The AI will analyze colors, typography, and layout from the image and apply them to your dashboard.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: schema.theme.primaryColor }}>
                    Tips
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Be specific: "make table text blue" is better than "change colors"</li>
                    <li>• Combine requests: "dark mode, two columns, add bar chart"</li>
                    <li>• Use presets to start fresh: Default, Blank, Dark Default, Dark Blank</li>
                    <li>• Images must include a URL when adding: "add image with url https://..."</li>
                  </ul>
                </section>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-6 py-2 rounded-lg font-medium transition-colors"
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
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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

  try {
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
        return (
          <div style={style}>
            <DataChart component={enhancedComponent} />
          </div>
        )
      case 'kpi':
        return (
          <div style={style}>
            <KPI component={enhancedComponent} theme={schema.theme} />
          </div>
        )
      case 'text':
        return (
          <div style={style}>
            <TextComponent component={enhancedComponent} />
          </div>
        )
      case 'image':
        return (
          <div style={style}>
            <ImageComponent component={enhancedComponent} />
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
