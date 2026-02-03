import Anthropic from '@anthropic-ai/sdk'
import { DesignSchema, Operation, Component } from './schema'
import { getOptimizedSchema } from './schemaOptimizer'
import { extractImageColors, ImageColorAnalysis } from './imageAnalysis'

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null

// Analyze uploaded image to extract style information
async function analyzeImageStyle(imageBase64: string): Promise<ImageColorAnalysis & { fullDescription: string }> {
  try {
    const colorAnalysis = await extractImageColors(imageBase64)
    const fullDescription = `${colorAnalysis.styleDescription} Overall aesthetic: ${colorAnalysis.themeMode} theme with ${colorAnalysis.primaryColors.length} primary colors. Use these exact hex codes: Background: ${colorAnalysis.backgroundColor}, Text: ${colorAnalysis.textColor}, Accent/Primary: ${colorAnalysis.accentColor}.`
    return { ...colorAnalysis, fullDescription }
  } catch {
    const fallback: ImageColorAnalysis = {
      primaryColors: ['#3b82f6', '#1a1a1a', '#ffffff'],
      themeMode: 'light',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      accentColor: '#3b82f6',
      styleDescription: 'Image uploaded for style reference. Apply modern, clean aesthetic with appropriate colors and typography.',
    }
    return { ...fallback, fullDescription: fallback.styleDescription }
  }
}

// Optimized system prompt for Claude 4.5 Haiku
const SYSTEM_PROMPT = `You are a dashboard design system. Transform user requests into JSON operations.

RESPONSE FORMAT: {"operations":[...]} — pure JSON, no markdown or text.

## OPERATIONS

| Operation | Format | Use Case |
|-----------|--------|----------|
| set_style | {"op":"set_style","path":"PATH","value":"VAL"} | Change colors, fonts, sizes |
| update | {"op":"update","path":"PATH","value":"VAL"} | Change layout, filters, props |
| add_component | {"op":"add_component","component":{...}} | Add new components |
| remove_component | {"op":"remove_component","id":"ID"} | Delete components |
| reorder_component | {"op":"reorder_component","id":"ID","newIndex":N} | Move component position |
| replace_component | {"op":"replace_component","id":"ID","component":{...}} | Swap component type |

## PATHS

Theme: theme/mode, theme/backgroundColor, theme/backgroundImage, theme/primaryColor, theme/textColor, theme/fontFamily
Layout: layout/columns (grid columns for component arrangement), layout/gap
Filters: filters/sortBy, filters/sortOrder, filters/limit
Component styles: components[id=ID]/style/PROPERTY

## COMPONENT EXAMPLES (COPY EXACTLY)

TEXT - props.content is THE ACTUAL TEXT STRING:
{"op":"add_component","component":{"id":"text1","type":"text","props":{"content":"Sales Dashboard","heading":true},"style":{"fontSize":"2rem"}}}

PIE CHART BY CATEGORY - MUST use xField:"category" and dataSource:"/api/data":
{"op":"add_component","component":{"id":"pie1","type":"pie_chart","props":{"dataSource":"/api/data","xField":"category","aggregateFunction":"count"},"style":{"height":"400px"}}}

BAR CHART BY CATEGORY:
{"op":"add_component","component":{"id":"bar1","type":"bar_chart","props":{"dataSource":"/api/data","xField":"category","aggregateFunction":"count"},"style":{"height":"400px"}}}

LINE CHART (time series):
{"op":"add_component","component":{"id":"chart1","type":"line_chart","props":{"dataSource":"/api/data/summary","xField":"month","yField":"total"},"style":{"height":"400px"}}}

KPI:
{"op":"add_component","component":{"id":"kpi1","type":"kpi","props":{"dataSource":"/api/data","calculation":"count","label":"Total Items"},"style":{}}}

TABLE (dataColumns splits data into side-by-side tables):
{"op":"add_component","component":{"id":"table1","type":"table","props":{"dataSource":"/api/data","columns":["id","title","category","price","date"],"dataColumns":1},"style":{}}}

## DATA SOURCES
- /api/data: Raw items with fields: id, title, category, price, date
- /api/data/summary: Monthly aggregates with: month, total, count, avgPrice

## GRADIENTS (use theme/backgroundImage or component style/backgroundImage)
- Sunset: "linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #ff9966 100%)"
- Ocean: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
- Forest: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)"

## BRAND STYLES
| Brand | Mode | Background | Primary | Text |
|-------|------|------------|---------|------|
| Netflix | dark | #141414 | #e50914 | #ffffff |
| Spotify | dark | #121212 | #1db954 | #ffffff |
| Uber Eats | light | #ffffff | #06c167 | #142328 |
| GitHub | dark | #0d1117 | #238636 | #c9d1d9 |

## DISAMBIGUATION - "COLUMNS" HAS 3 MEANINGS

1. **Layout columns** ("two columns", "3 column layout") = layout/columns (grid arrangement of components)
2. **Table data columns** ("table in 2 columns", "split table into 3 columns") = props.dataColumns (splits rows into side-by-side tables)
3. **Table attribute columns** ("only show id and price", "hide category column") = props.columns array

EXAMPLES:
- "two columns" → {"op":"update","path":"layout/columns","value":2}
- "table in 2 columns" → {"op":"update","path":"components[id=table1]/props/dataColumns","value":2}
- "split the table into 3 columns" → {"op":"update","path":"components[id=table1]/props/dataColumns","value":3}
- "only show title and price" → {"op":"update","path":"components[id=table1]/props/columns","value":["title","price"]}

## CRITICAL RULES
1. TEXT content: props.content MUST be the exact text string user wants displayed
2. PIE/BAR by category: MUST use dataSource:"/api/data", xField:"category"
3. For KPIs: never set height, always include dataSource="/api/data"
4. For images: only use URLs explicitly provided by user
5. For "at top": add component, then reorder to newIndex:0
6. Only reference component IDs that exist in the schema`

export async function generateDesignOperations(
  prompt: string,
  currentSchema: DesignSchema,
  uploadedImages: string[] = []
): Promise<Operation[]> {
    // Analyze uploaded images for style extraction
  const uploadedImageStyles: Array<ImageColorAnalysis & { fullDescription: string }> = []
    if (uploadedImages.length > 0) {
      for (const imageBase64 of uploadedImages) {
        try {
        const styleAnalysis = await analyzeImageStyle(imageBase64)
        uploadedImageStyles.push(styleAnalysis)
      } catch {
          // Continue with other images even if one fails
        }
      }
    }

  // Extract URLs from prompt and create placeholders
  const urlRegex = /(https?:\/\/[^\s"'<>]+|data:image\/[a-zA-Z]+;base64,[^\s"'<>]+)/gi
  const extractedUrls = prompt.match(urlRegex) || []
  const urlPlaceholderMap = new Map<string, string>()
    const urlMap = new Map<number, string>()
    
    let processedPrompt = prompt
      extractedUrls.forEach((url, index) => {
        const placeholder = `[IMAGE_URL_${index + 1}]`
        urlPlaceholderMap.set(placeholder, url)
    urlMap.set(index, url)
    processedPrompt = processedPrompt.replace(url, placeholder)
  })

  // Detect intent for uploaded images
  const hasUploadedImages = uploadedImages.length > 0
  const hasAddIntent = /\b(add|create|insert|show|display)\b/i.test(prompt.toLowerCase())
  const hasStyleIntent = /\b(style|look like|make it like|replicate|match|similar|inspired|vibe)\b/i.test(prompt.toLowerCase())
  const hasImageWord = /\b(image|images|picture|pictures|photo|photos)\b/i.test(prompt.toLowerCase())
  
  // If user uploaded images + says "add" + mentions images = add as components
  // If user uploaded images + says style words = apply style from images
  // If ambiguous, default to style replication
  const isAddImageIntent = hasUploadedImages && hasAddIntent && (hasImageWord || (!hasStyleIntent && !hasImageWord))
  const isStyleIntent = hasUploadedImages && (hasStyleIntent || (!hasAddIntent && !hasImageWord))

  // Optimize schema - always include component IDs and types
  const optimizedSchema = getOptimizedSchema(currentSchema, prompt)
  const schemaJson = JSON.stringify(optimizedSchema)

  // Build user prompt
  let userPrompt = `Current schema: ${schemaJson}

User request: ${processedPrompt}`
    
  // Add URL placeholder mapping
    if (urlPlaceholderMap.size > 0) {
    userPrompt += `\n\nImage placeholders: ${Array.from(urlPlaceholderMap.keys()).join(', ')} (use these in src field)`
  }

  // Handle uploaded images
  if (isAddImageIntent) {
    userPrompt += `\n\nUser uploaded ${uploadedImages.length} image(s) to ADD as components.`
    uploadedImages.forEach((_, index) => {
        const placeholder = `[UPLOADED_IMAGE_${index + 1}]`
      urlPlaceholderMap.set(placeholder, uploadedImages[index])
      userPrompt += `\nCreate add_component for image ${index + 1}: id="img${index + 1}", src="${placeholder}"`
    })
  } else if (isStyleIntent && uploadedImageStyles.length > 0) {
    userPrompt += `\n\nUser uploaded image(s) for STYLE REPLICATION. Extract style analysis:`
    uploadedImageStyles.forEach((style, index) => {
      userPrompt += `\n\nImage ${index + 1}:`
      userPrompt += `\n- Background: ${style.backgroundColor}`
      userPrompt += `\n- Text: ${style.textColor}`
      userPrompt += `\n- Accent: ${style.accentColor}`
      userPrompt += `\n- Theme: ${style.themeMode}`
      userPrompt += `\n- Colors: ${style.primaryColors.slice(0, 5).join(', ')}`
    })
    userPrompt += `\n\nApply these EXACT colors to theme and ALL components. Do NOT add image components.`
  }

  userPrompt += `\n\nReturn ONLY valid JSON: {"operations":[...]}`

  // Use timeout for API calls (design spec: cancel LLM after 10s)
  const timeoutMs = 10000

  if (!anthropic) {
    throw new Error('No AI provider configured. Please set ANTHROPIC_API_KEY in your environment variables')
  }
  
  const message = await Promise.race([
    anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs/1000}s`)), timeoutMs)
    ),
  ])

  const content = message.content[0]?.type === 'text' ? message.content[0].text : null
  if (!content) {
    throw new Error('No response from AI. Please try again.')
  }

  // Parse JSON response
    let operations: any[] = []
    try {
    const parsed = JSON.parse(content.trim())
      operations = Array.isArray(parsed) ? parsed : parsed.operations || []
  } catch {
    // Try to extract JSON from response
      let cleaned = content.trim()
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
      
      try {
      const parsed = JSON.parse(cleaned)
        operations = Array.isArray(parsed) ? parsed : parsed.operations || []
      } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
          try {
          const parsed = JSON.parse(jsonMatch[0])
            operations = Array.isArray(parsed) ? parsed : parsed.operations || []
          } catch {
          throw new Error('Failed to parse AI response. Please try rephrasing your request.')
        }
      } else {
        throw new Error('Failed to parse AI response. Please try rephrasing your request.')
        }
      }
    }

    // Validate and sanitize operations
    const validOps = ['set_style', 'update', 'add_component', 'remove_component', 'move_component', 'replace_component', 'reorder_component']
  const validatedOperations: Operation[] = []

  // Helper: coerce string numbers to actual numbers for certain paths
  const coerceNumber = (path: string, value: any): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'string') return null
    const match = value.trim().match(/-?\d+(\.\d+)?/)
    if (!match) return null
      const num = Number(match[0])
    if (!Number.isFinite(num)) return null
    if (path === 'layout/columns') return Math.max(1, Math.round(num))
    if (path === 'layout/gap' || path === 'filters/limit') return Math.max(0, Math.round(num))
    return num
  }

  // Helper: expand style object to individual set_style ops
  const expandStyleObject = (op: any): Operation[] => {
    const id = String(op?.id || op?.componentId || '')
    const styleObj = op?.style
      if (!id || !styleObj || typeof styleObj !== 'object') return []
    return Object.entries(styleObj)
      .filter(([_, val]) => val !== undefined)
      .map(([key, val]) => ({
        op: 'set_style' as const,
          path: `components[id=${id}]/style/${key}`,
          value: val,
      }))
    }

    for (const op of operations) {
    if (!op || typeof op !== 'object') continue

      const opType = op.op || op.type
    if (!opType || !validOps.includes(opType)) continue

      try {
        switch (opType) {
          case 'set_style':
            if (!op.path || op.value === undefined) {
            const expanded = expandStyleObject(op)
              if (expanded.length > 0) {
                validatedOperations.push(...expanded)
              }
              continue
            }
            {
            let path = String(op.path).replace(/\./g, '/')
              let value = op.value
            if (['layout/columns', 'layout/gap', 'filters/limit'].includes(path)) {
              const coerced = coerceNumber(path, value)
              if (coerced === null) continue
              value = coerced
            }
              validatedOperations.push({ op: 'set_style', path, value })
            }
            break

          case 'update':
          if (!op.path || op.value === undefined) continue
          {
            let path = String(op.path).replace(/\./g, '/')
            let value = op.value
            if (['layout/columns', 'layout/gap', 'filters/limit'].includes(path)) {
              const coerced = coerceNumber(path, value)
              if (coerced === null) continue
              value = coerced
            }
              validatedOperations.push({ op: 'update', path, value })
            }
            break

          case 'add_component':
          const component = op.component || op.value || op
          if (!component?.id || !component?.type) continue
          
          const allowedTypes = ['table', 'chart', 'kpi', 'text', 'image', 'pie_chart', 'bar_chart', 'line_chart', 'area_chart', 'scatter_chart', 'radar_chart', 'histogram', 'composed_chart']
          if (!allowedTypes.includes(component.type)) continue

            const validatedComponent: Component = {
              id: String(component.id),
            type: component.type as Component['type'],
              props: component.props || {},
              style: component.style || {},
            }
            
          // Handle KPI components - strip height to prevent cutoff
          if (component.type === 'kpi' && validatedComponent.style?.height) {
            delete validatedComponent.style.height
          }
          
          // Handle image components
          if (component.type === 'image') {
            let src = validatedComponent.props?.src
            if (!src || typeof src !== 'string') continue
                
                // Replace placeholders with actual URLs
            if (urlPlaceholderMap.has(src)) {
              src = urlPlaceholderMap.get(src)!
                  } else {
                    for (const [placeholder, fullUrl] of Array.from(urlPlaceholderMap.entries())) {
                if (src.includes(placeholder)) {
                  src = src.replace(placeholder, fullUrl)
                            break
                          }
                        }
                      }
                      
            // Skip placeholder/example URLs
            const lowerSrc = src.toLowerCase()
            if (['example.com', 'placeholder', 'via.placeholder.com', 'placehold.it', 'dummyimage.com'].some(p => lowerSrc.includes(p))) {
                  continue
            }

            validatedComponent.props.src = src
            if (!validatedComponent.style) validatedComponent.style = {}
            if (!validatedComponent.style.objectFit) validatedComponent.style.objectFit = 'contain'
            }
            
          validatedOperations.push({ op: 'add_component', component: validatedComponent })
          break

        case 'remove_component':
          if (!op.id) continue
            validatedOperations.push({ op: 'remove_component', id: String(op.id) })
            break

          case 'replace_component':
          const replaceComp = op.component || op
          if (!op.id || !replaceComp?.id || !replaceComp?.type) continue
          validatedOperations.push({ op: 'replace_component', id: String(op.id), component: replaceComp })
            break

          case 'move_component':
          if (!op.id || !op.position || typeof op.position.x !== 'number' || typeof op.position.y !== 'number') continue
            validatedOperations.push({
              op: 'move_component',
              id: String(op.id),
            position: { x: op.position.x, y: op.position.y, width: op.position.width, height: op.position.height },
            })
            break

          case 'reorder_component':
          if (!op.id || typeof op.newIndex !== 'number') continue
          const reorderId = String(op.id)
          // Validate component exists in schema
          if (!currentSchema.components?.some(c => c.id === reorderId)) continue
          validatedOperations.push({ op: 'reorder_component', id: reorderId, newIndex: op.newIndex })
            break
        }
    } catch {
        continue
      }
    }

  // Check for image request without URL
    if (validatedOperations.length === 0) {
    const isImageRequest = /\b(add|create|insert).*(image|picture|photo)\b/i.test(prompt)
    if (isImageRequest && extractedUrls.length === 0 && uploadedImages.length === 0) {
      throw new Error('To add an image, please provide an image URL or upload an image.')
    }
    if (operations.length > 0) {
      throw new Error('No valid operations found. Please try rephrasing your request.')
    }
  }

  // Auto-inject reorder operations when prompt says "at top" or "at beginning"
  const wantsAtTop = /\b(at\s+(the\s+)?(top|beginning|start)|^add.*first)\b/i.test(prompt)
  if (wantsAtTop) {
    const addOps = validatedOperations.filter(op => op.op === 'add_component')
    const hasReorderForAdded = validatedOperations.some(op => 
      op.op === 'reorder_component' && addOps.some(a => (a as any).component?.id === op.id)
    )
    
    if (addOps.length > 0 && !hasReorderForAdded) {
      // Inject reorder operations to move newly added components to top
      addOps.forEach((addOp, index) => {
        const componentId = (addOp as any).component?.id
        if (componentId) {
          validatedOperations.push({
            op: 'reorder_component',
            id: componentId,
            newIndex: index,
          })
        }
      })
    }
  }
  
  // Limit operations
  return validatedOperations.slice(0, 30)
}
