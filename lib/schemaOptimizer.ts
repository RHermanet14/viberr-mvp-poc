import { DesignSchema, Component } from './schema'

// Remove null/undefined values from schema
function cleanSchema(schema: any): any {
  return JSON.parse(JSON.stringify(schema, (key, value) => 
    value === null || value === undefined ? undefined : value
  ))
}

// Create minimal component representation (only ID and type)
function getMinimalComponent(component: Component): { id: string; type: string } {
  return {
    id: component.id,
    type: component.type,
  }
}

// Context-aware schema reduction based on prompt type
export function getOptimizedSchema(schema: DesignSchema, prompt: string): any {
  const lower = prompt.toLowerCase()
  const cleaned = cleanSchema(schema)
  
  // Detect vague style requests
  const isVagueRequest = /\b(like|similar|make it|style of|look like|resemble|inspired by)\b/i.test(prompt)
  
  // More aggressive optimization: if schema has many components, always minimize
  const hasManyComponents = cleaned.components && cleaned.components.length > 10
  
  // Theme operations - only need theme and layout
  if (lower.match(/\b(dark|light|theme|color|background|mode)\b/) && 
      !lower.match(/\b(add|remove|delete|create|show|hide|column|chart|kpi|table|text)\b/)) {
    return {
      theme: cleaned.theme,
      layout: cleaned.layout,
      components: cleaned.components.map(getMinimalComponent), // Just IDs/types for reference
      filters: cleaned.filters,
    }
  }
  
  // Component operations (add/remove/reorder) - need ONLY component IDs/types for reference
  // This dramatically reduces token count for simple add/remove operations
  if (lower.match(/\b(add|remove|delete|reorder|move|replace)\b/)) {
    // For empty dashboard, very simple operations, OR many components, send absolute minimum
    if (cleaned.components.length === 0 || hasManyComponents || lower.match(/\b(add|remove)\s+(a|an|the)?\s*(chart|kpi|table|text|pie|bar|line|image)\b/)) {
      return {
        theme: cleaned.theme,
        layout: cleaned.layout,
        components: cleaned.components.map(getMinimalComponent), // Just IDs/types
        filters: cleaned.filters,
      }
    }
    // For more complex operations, include minimal props
    return {
      ...cleaned,
      components: cleaned.components.map((c: Component) => ({
        id: c.id,
        type: c.type,
        // Only include essential props for component operations
        props: c.props ? {
          dataSource: c.props.dataSource,
          // Include other props only if they exist and are non-empty
          ...(c.props.columns ? { columns: c.props.columns } : {}),
          ...(c.props.chartType ? { chartType: c.props.chartType } : {}),
          ...(c.props.xField ? { xField: c.props.xField } : {}),
          ...(c.props.yField ? { yField: c.props.yField } : {}),
          // Include src for image components (required)
          ...(c.type === 'image' && c.props.src ? { src: c.props.src } : {}),
        } : undefined,
        // Don't include style for component operations
      })),
    }
  }
  
  // Style operations - need component IDs/types + style objects
  if (lower.match(/\b(style|color|size|font|bigger|smaller|padding|margin|border|shadow)\b/)) {
    return {
      ...cleaned,
      components: cleaned.components.map((c: Component) => ({
        id: c.id,
        type: c.type,
        style: c.style ? Object.keys(c.style).reduce((acc, key) => {
          const value = c.style![key as keyof typeof c.style]
          if (value !== undefined && value !== null) {
            acc[key] = value
          }
          return acc
        }, {} as any) : undefined,
      })),
    }
  }
  
  // For vague requests, send minimal schema but keep all component IDs/types
  if (isVagueRequest) {
    return {
      theme: cleaned.theme,
      layout: cleaned.layout,
      components: cleaned.components.map((c: Component) => ({
        id: c.id,
        type: c.type,
        // Include minimal style info for vague requests
        style: c.style ? {
          backgroundColor: c.style.backgroundColor,
          backgroundImage: c.style.backgroundImage,
          color: c.style.color,
          fontFamily: c.style.fontFamily,
          cardStyle: c.style.cardStyle,
        } : undefined,
      })),
      filters: cleaned.filters,
    }
  }
  
  // Default: send cleaned full schema
  return cleaned
}

// Check if request is vague (needs more processing time)
export function isVagueRequest(prompt: string): boolean {
  const vagueKeywords = ['like', 'similar', 'make it', 'style of', 'look like', 'resemble', 'inspired by', 'netflix', 'uber', 'spotify', 'amazon']
  return vagueKeywords.some(keyword => prompt.toLowerCase().includes(keyword))
}
