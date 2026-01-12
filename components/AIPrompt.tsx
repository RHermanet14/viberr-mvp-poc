'use client'

import { useState } from 'react'
import { DesignSchema } from '@/lib/schema'

interface AIPromptProps {
  onPrompt: (prompt: string) => Promise<void>
  schema?: DesignSchema | null
  showExamples?: boolean
}

export function AIPrompt({ onPrompt, schema, showExamples = true }: AIPromptProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || loading) return

    setLoading(true)
    try {
      await onPrompt(prompt)
      setPrompt('')
    } finally {
      setLoading(false)
    }
  }

  const isDark = schema?.theme.mode === 'dark'
  const inputStyle = {
    backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
    color: isDark ? '#ffffff' : '#000000',
    borderColor: isDark ? '#4a4a4a' : '#d1d5db',
  }
  const textColor = isDark ? '#9ca3af' : '#6b7280'

  const primaryColor = schema?.theme.primaryColor || '#3b82f6'

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-w-0">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Try: 'Make it dark mode, bigger text, show top 10 by revenue, add a bar chart by month'"
          className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none"
          style={{
            ...inputStyle,
            height: '32px',
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 2px ${primaryColor}40`
            e.currentTarget.style.borderColor = primaryColor
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = ''
            e.currentTarget.style.borderColor = inputStyle.borderColor as string
          }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="px-4 py-1.5 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          style={{
            backgroundColor: primaryColor,
            color: '#ffffff',
            height: '32px',
          }}
          onMouseEnter={(e) => {
            if (!loading && prompt.trim()) {
              e.currentTarget.style.opacity = '0.9'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
        >
          {loading ? 'Processing...' : 'Apply'}
        </button>
      </div>
      {showExamples !== false && (
        <p className="mt-1.5 text-xs" style={{ color: textColor }}>
          Examples: "Dark mode", "Bigger font", "Two columns", "Add pie chart", "Sort by price"
        </p>
      )}
    </form>
  )
}
