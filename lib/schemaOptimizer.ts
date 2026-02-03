import { DesignSchema, Component } from './schema'

// Remove null/undefined values from schema AND strip large data URLs
function cleanSchema(schema: any): any {
  return JSON.parse(JSON.stringify(schema, (key, value) => {
    if (value === null || value === undefined) return undefined
    // Strip large data URLs from image src (they can be 1MB+)
    if (key === 'src' && typeof value === 'string' && value.startsWith('data:')) {
      return '[IMAGE_DATA]' // Placeholder so AI knows there's an image
    }
    return value
  }))
}

// Create minimal component representation (ID and type only)
function getMinimalComponent(component: Component): { id: string; type: string } {
  return {
    id: component.id,
    type: component.type,
  }
}

// Optimize schema to reduce tokens while keeping essential info for AI
export function getOptimizedSchema(schema: DesignSchema, prompt: string): any {
  const lower = prompt.toLowerCase()
  const cleaned = cleanSchema(schema)
  
  // Always include component IDs and types - this is critical for the AI
  // to know what components exist for reorder/remove/style operations
  
  // Theme-only operations
  if (lower.match(/\b(dark|light|theme|mode)\b/) && 
      !lower.match(/\b(add|remove|delete|create|chart|kpi|table|text|image|reorder|move)\b/)) {
    return {
      theme: cleaned.theme,
      layout: cleaned.layout,
      components: cleaned.components.map(getMinimalComponent),
      filters: cleaned.filters,
    }
  }
  
  // Component operations (add/remove/reorder/replace) - minimal schema
  if (lower.match(/\b(add|remove|delete|reorder|move|replace|between|top|bottom)\b/)) {
    return {
      theme: cleaned.theme,
      layout: cleaned.layout,
      components: cleaned.components.map(getMinimalComponent),
      filters: cleaned.filters,
    }
  }
  
  // Style operations - include current styles for context
  if (lower.match(/\b(style|color|red|blue|green|font|bigger|smaller|padding|margin|border|fullscreen|width|height|size|resize|gradient|background)\b/)) {
    return {
      theme: cleaned.theme,
      layout: cleaned.layout,
      components: cleaned.components.map((c: Component) => ({
        id: c.id,
        type: c.type,
        style: c.style || {},
      })),
      filters: cleaned.filters,
    }
  }
  
  // Vague/brand requests - minimal with component IDs
  if (isVagueRequest(prompt)) {
    return {
      theme: cleaned.theme,
      layout: cleaned.layout,
      components: cleaned.components.map(getMinimalComponent),
      filters: cleaned.filters,
    }
  }
  
  // Default: cleaned full schema
  return cleaned
}

// Simple check for vague/brand-style requests
export function isVagueRequest(prompt: string): boolean {
  const lower = prompt.toLowerCase()

  // Brand resemblance phrases
  const vaguePhrases = [
    'make it like', 'similar to', 'style of', 'look like', 
    'resemble', 'inspired by', 'in the style of', 'vibe of'
  ]
  if (vaguePhrases.some(p => lower.includes(p))) return true

  // "X mode" pattern (Netflix mode, Spotify mode) but NOT dark/light mode
  if (/\b\w+\s+mode\b/.test(lower) && !/\b(dark|light)\s+mode\b/.test(lower)) return true

  // "X style" pattern but NOT component style
  if (/\b\w+\s+style\b/.test(lower) && !/\b(table|chart|border|grid)\s+style\b/.test(lower)) return true

  return false
}
