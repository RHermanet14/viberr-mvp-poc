import Groq from 'groq-sdk'
import { DesignSchema, Operation, Component } from './schema'
import { getOptimizedSchema } from './schemaOptimizer'
import { extractImageColors, ImageColorAnalysis } from './imageAnalysis'

const groq = process.env.GROQ_API_KEY ? new Groq({
  apiKey: process.env.GROQ_API_KEY,
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

// Consolidated system prompt - always complete, no dynamic building
const SYSTEM_PROMPT = `You are UI Design Ops. Edit dashboard schema via JSON operations only.

CONSTRAINTS
- Only presentation: layout, components, styles, sorting/filtering. Never backend/data/auth/API/db.
- Max 30 components. Vague requests (brand styling): max 15 ops.
- Output: {"operations":[...]} JSON only. No markdown/explanations.
- CRITICAL: Each operation MUST have "op" field (not "type").

OPERATIONS
1. set_style: Change theme or component styles
   Format: {"op":"set_style","path":"theme/X or components[id=ID]/style/X","value":"..."}
   Paths: theme/mode, theme/backgroundColor, theme/primaryColor, theme/textColor, theme/fontFamily
          components[id=ID]/style/color, components[id=ID]/style/textColor, components[id=ID]/style/backgroundColor

2. update: Change props or layout
   Format: {"op":"update","path":"...","value":"..."}
   Paths: layout/columns, layout/gap, filters/sortBy, filters/sortOrder, filters/limit
          components[id=ID]/props/columns (for tables)

3. add_component: Add new component
   Format: {"op":"add_component","component":{"id":"unique_id","type":"TYPE","props":{...},"style":{...}}}
   
4. remove_component: Remove by ID
   Format: {"op":"remove_component","id":"EXACT_ID_FROM_SCHEMA"}
   
5. reorder_component: Change position in array
   Format: {"op":"reorder_component","id":"EXACT_ID_FROM_SCHEMA","newIndex":N}
   
6. replace_component: Replace component with new one
   Format: {"op":"replace_component","id":"EXACT_ID_FROM_SCHEMA","component":{...}}

COMPONENT TYPES + REQUIRED PROPS
- table: dataSource="/api/data", columns=["id","title","price","date"]
- chart/line_chart: dataSource="/api/data/summary", xField="month", yField="total"
- pie_chart/bar_chart: dataSource="/api/data", xField="category", aggregateFunction="count"
- kpi: dataSource="/api/data", calculation="count"|"avg"|"sum", field="price" (for avg/sum), label="Label"
- text: content="Text content", heading=true|false
- image: src="USER_PROVIDED_URL" (REQUIRED - never invent URLs)

DATA SOURCES
- /api/data: Raw items (id, title, category, price, date). Use for: KPIs, tables, charts by category.
- /api/data/summary: Time series (month, total, count, avgPrice). DEFAULT for line/area charts.

CRITICAL RULES
1. ALWAYS check schema for existing component IDs before reorder/remove/style operations
2. NEVER invent component IDs - use ONLY IDs that exist in the schema's components array
3. For "between X and Y": Find component indices, place at index between them
   Example: pie1 at index 0, table1 at index 2 → to put img1 between them, use newIndex:1
4. For "make X red": Find component ID by type in schema, use set_style with that exact ID
5. For "remove all X": Generate one remove_component per matching component in schema
6. For "make everything red": Generate set_style for EACH component in schema
7. For images: NEVER generate/invent URLs - only use user-provided URLs or placeholders
8. KPIs ALWAYS need dataSource="/api/data" - they will be empty without it
9. Charts by category use dataSource="/api/data" with xField="category", aggregateFunction="count"

STYLE PROPERTIES
Typography: fontSize, fontFamily, fontWeight, textAlign, letterSpacing, lineHeight, textTransform
Colors: color (charts), textColor, backgroundColor, borderColor, valueColor (KPIs), labelColor
Layout: width, height, padding, margin, borderRadius, boxShadow, opacity

FONTS (Google Fonts)
"gothic"/"bold" → "Oswald" or "Bebas Neue"
"elegant"/"classic" → "Playfair Display" or "Merriweather"  
"modern"/"clean" → "Roboto" or "Montserrat"
"handwritten" → "Dancing Script"
"futuristic" → "Orbitron"

EXAMPLES
Dark mode: {"operations":[{"op":"set_style","path":"theme/mode","value":"dark"},{"op":"set_style","path":"theme/backgroundColor","value":"#141414"}]}

Add pie chart: {"operations":[{"op":"add_component","component":{"id":"pie1","type":"pie_chart","props":{"dataSource":"/api/data","xField":"category","aggregateFunction":"count"},"style":{"width":"100%","height":"400px"}}}]}

Add KPI: {"operations":[{"op":"add_component","component":{"id":"kpi1","type":"kpi","props":{"dataSource":"/api/data","calculation":"count","label":"Total Items"},"style":{"width":"100%"}}}]}

Add KPIs at top: When user says "at top/beginning", add components THEN reorder each to front (index 0,1,2...)
Example "Add 3 KPIs at top": {"operations":[{"op":"add_component","component":{"id":"kpi1","type":"kpi","props":{"dataSource":"/api/data","calculation":"count","label":"Total Items"},"style":{"width":"100%"}}},{"op":"add_component","component":{"id":"kpi2","type":"kpi","props":{"dataSource":"/api/data","calculation":"avg","field":"price","label":"Avg Price"},"style":{"width":"100%"}}},{"op":"add_component","component":{"id":"kpi3","type":"kpi","props":{"dataSource":"/api/data","calculation":"max","field":"price","label":"Max Price"},"style":{"width":"100%"}}},{"op":"reorder_component","id":"kpi1","newIndex":0},{"op":"reorder_component","id":"kpi2","newIndex":1},{"op":"reorder_component","id":"kpi3","newIndex":2}]}

IMPORTANT FOR KPIs: NEVER set height on KPIs - they need auto-height to display properly. Only set width.

Style chart red: {"operations":[{"op":"set_style","path":"components[id=chart1]/style/color","value":"#ff0000"}]}

Reorder (put chart at top): {"operations":[{"op":"reorder_component","id":"chart1","newIndex":0}]}

Put image between pie and table: {"operations":[{"op":"reorder_component","id":"img1","newIndex":1}]}

Replace chart with pie: {"operations":[{"op":"replace_component","id":"chart1","component":{"id":"chart1","type":"pie_chart","props":{"dataSource":"/api/data","xField":"category","aggregateFunction":"count"},"style":{"width":"100%","height":"400px"}}}]}

Remove all images: {"operations":[{"op":"remove_component","id":"img1"},{"op":"remove_component","id":"img2"}]}

Top 10 by price: {"operations":[{"op":"update","path":"filters/sortBy","value":"price"},{"op":"update","path":"filters/sortOrder","value":"desc"},{"op":"update","path":"filters/limit","value":10}]}

Table only show title and price: {"operations":[{"op":"update","path":"components[id=table1]/props/columns","value":["title","price"]}]}

Netflix style: {"operations":[{"op":"set_style","path":"theme/mode","value":"dark"},{"op":"set_style","path":"theme/backgroundColor","value":"#141414"},{"op":"set_style","path":"theme/primaryColor","value":"#e50914"},{"op":"set_style","path":"theme/textColor","value":"#ffffff"},{"op":"set_style","path":"components[id=chart1]/style/color","value":"#e50914"},{"op":"set_style","path":"components[id=table1]/style/textColor","value":"#e50914"}]}

Spotify style: {"operations":[{"op":"set_style","path":"theme/mode","value":"dark"},{"op":"set_style","path":"theme/backgroundColor","value":"#121212"},{"op":"set_style","path":"theme/primaryColor","value":"#1db954"},{"op":"set_style","path":"theme/textColor","value":"#ffffff"},{"op":"set_style","path":"components[id=chart1]/style/color","value":"#1db954"}]}

Uber Eats style: {"operations":[{"op":"set_style","path":"theme/mode","value":"light"},{"op":"set_style","path":"theme/backgroundColor","value":"#ffffff"},{"op":"set_style","path":"theme/primaryColor","value":"#06c167"},{"op":"set_style","path":"theme/textColor","value":"#000000"},{"op":"set_style","path":"components[id=chart1]/style/color","value":"#06c167"}]}`

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

    if (!groq) {
      throw new Error('No AI provider configured. Please set GROQ_API_KEY in your environment variables')
    }
    
    const completion = await Promise.race([
      groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
        messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
        ],
      temperature: 0.2,
        response_format: { type: 'json_object' },
      max_tokens: 2000,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs/1000}s`)), timeoutMs)
      ),
    ])

    const content = completion.choices[0]?.message?.content
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
