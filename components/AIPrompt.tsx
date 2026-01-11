'use client'

import { useState } from 'react'

interface AIPromptProps {
  onPrompt: (prompt: string) => Promise<void>
}

export function AIPrompt({ onPrompt }: AIPromptProps) {
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

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Try: 'Make it dark mode, bigger text, show top 10 by revenue, add a bar chart by month'"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : 'Apply'}
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        Examples: "Dark mode", "Bigger font", "Two columns", "Add pie chart", "Sort by price"
      </p>
    </form>
  )
}
