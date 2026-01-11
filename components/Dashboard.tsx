'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { DesignSchema, Component } from '@/lib/schema'
import { DataTable } from './DataTable'
import { DataChart } from './DataChart'
import { KPI } from './KPI'
import { TextComponent } from './TextComponent'
import { AIPrompt } from './AIPrompt'

export function Dashboard() {
  const { data: session, status } = useSession()
  const [schema, setSchema] = useState<DesignSchema | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated') {
      loadSchema()
    }
  }, [status])

  const loadSchema = async () => {
    try {
      const res = await fetch('/api/schema')
      if (res.ok) {
        const data = await res.json()
        setSchema(data)
      }
    } catch (error) {
      console.error('Failed to load schema:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAIPrompt = async (prompt: string) => {
    if (!schema) return

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, schema }),
      })

      if (res.ok) {
        const { schema: updatedSchema } = await res.json()
        setSchema(updatedSchema)
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to process AI prompt:', error)
      alert('Failed to process AI prompt')
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-8">Loading...</div>
  }

  if (status === 'unauthenticated') {
    return (
      <div className="p-8">
        <a href="/auth/signin" className="text-blue-600 underline">
          Sign in to continue
        </a>
      </div>
    )
  }

  if (!schema) {
    return <div className="p-8">Failed to load schema</div>
  }

  const themeStyles = {
    backgroundColor: schema.theme.mode === 'dark' ? '#1a1a1a' : '#ffffff',
    color: schema.theme.mode === 'dark' ? '#ffffff' : '#000000',
    fontSize: schema.theme.fontSize,
    fontFamily: schema.theme.fontFamily,
  }

  return (
    <div style={themeStyles} className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Personalized Dashboard</h1>
        
        <AIPrompt onPrompt={handleAIPrompt} />

        <div
          className="mt-8"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${schema.layout.columns}, 1fr)`,
            gap: `${schema.layout.gap}px`,
          }}
        >
          {schema.components.map((component) => (
            <ComponentRenderer
              key={component.id}
              component={component}
              schema={schema}
              filters={schema.filters}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ComponentRenderer({
  component,
  schema,
  filters,
}: {
  component: Component
  schema: DesignSchema
  filters?: DesignSchema['filters']
}) {
  const style = {
    ...component.style,
    ...(component.position && {
      gridColumn: `span ${component.position.width || 1}`,
      gridRow: `span ${component.position.height || 1}`,
    }),
  }

  switch (component.type) {
    case 'table':
      return (
        <div style={style}>
          <DataTable component={component} filters={filters} />
        </div>
      )
    case 'chart':
      return (
        <div style={style}>
          <DataChart component={component} />
        </div>
      )
    case 'kpi':
      return (
        <div style={style}>
          <KPI component={component} />
        </div>
      )
    case 'text':
      return (
        <div style={style}>
          <TextComponent component={component} />
        </div>
      )
    default:
      return null
  }
}
