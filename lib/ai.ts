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

// Optimized system prompt
const SYSTEM_PROMPT = `Dashboard design system. Transform requests into JSON operations.
RESPONSE: {"operations":[...]} — pure JSON only.

## OPERATIONS
set_style: {"op":"set_style","path":"PATH","value":"VAL"} — colors, fonts, sizes
update: {"op":"update","path":"PATH","value":"VAL"} — layout, filters, props, styleHover
add_component: {"op":"add_component","component":{...}}
remove_component: {"op":"remove_component","id":"ID"}
reorder_component: {"op":"reorder_component","id":"ID","newIndex":N}
replace_component: {"op":"replace_component","id":"ID","component":{...}}

## PATHS
Theme: theme/mode, theme/backgroundColor, theme/backgroundImage, theme/primaryColor, theme/textColor, theme/fontFamily
Layout: layout/columns, layout/gap
Filters: filters/sortBy, filters/sortOrder, filters/limit
Styles: components[id=ID]/style/PROPERTY (any CSS camelCase)
Hover: components[id=ID]/styleHover (object with transform, boxShadow, etc.)
Chart internals: components[id=ID]/props/chartTheme/PROPERTY

## DATA
/api/data: id, title, category, price, date
/api/data/summary: month, total, count, avgPrice

## COMPONENTS
TEXT: {"op":"add_component","component":{"id":"text1","type":"text","props":{"content":"ACTUAL TEXT HERE","heading":true},"style":{"fontSize":"2rem"}}}
PIE (by category): {"op":"add_component","component":{"id":"pie1","type":"pie_chart","props":{"dataSource":"/api/data","xField":"category","aggregateFunction":"count"},"style":{"height":"400px"}}}
BAR (by category): {"op":"add_component","component":{"id":"bar1","type":"bar_chart","props":{"dataSource":"/api/data","xField":"category","aggregateFunction":"count"},"style":{"height":"400px"}}}
LINE (time series): {"op":"add_component","component":{"id":"chart1","type":"line_chart","props":{"dataSource":"/api/data/summary","xField":"month","yField":"total"},"style":{"height":"400px"}}}
SCATTER (x vs y): {"op":"add_component","component":{"id":"scatter1","type":"scatter_chart","props":{"dataSource":"/api/data","xField":"price","yField":"id"},"style":{"height":"400px"}}}
RADAR (multi-metric): {"op":"add_component","component":{"id":"radar1","type":"radar_chart","props":{"dataSource":"/api/data/summary"},"style":{"height":"400px"}}}
KPI: {"op":"add_component","component":{"id":"kpi1","type":"kpi","props":{"dataSource":"/api/data","calculation":"count","label":"Total Items"},"style":{}}}
TABLE: {"op":"add_component","component":{"id":"table1","type":"table","props":{"dataSource":"/api/data","columns":["id","title","category","price","date"],"dataColumns":1},"style":{}}}

## DEEP STYLING

chartTheme (charts): gridColor, gridOpacity, axisColor, tickColor, tickFontSize, tooltipBg, tooltipTextColor, tooltipBorderColor, legendTextColor, seriesColors[]
{"op":"update","path":"components[id=chart1]/props/chartTheme","value":{"gridColor":"#333","tooltipBg":"#222","seriesColors":["#ff6384","#36a2eb"]}}

KPI style: labelFontSize, labelFontWeight, valueFontSize, valueFontWeight, labelColor, valueColor

Table style: headerBackgroundColor, headerTextColor, rowStripeColor, dividerColor, cellPadding, rowHoverColor

Universal: Any CSS in camelCase — backgroundColor, borderRadius, boxShadow, backdropFilter, transform, opacity, etc.

## ANIMATIONS (style.animate)
Presets: float, pulse, glow, shimmer, bounce, fadeIn, slideUp, tilt, none
Optional: animationDuration, animationDelay
{"op":"set_style","path":"components[id=kpi1]/style/animate","value":"float"}

## HOVER (styleHover)
{"op":"update","path":"components[id=kpi1]/styleHover","value":{"transform":"translateY(-4px)","boxShadow":"0 12px 24px rgba(0,0,0,0.2)"}}

## VIBES & AESTHETICS
For vibe/mood/aesthetic requests, creatively combine: theme colors + fontFamily + animations + styleHover + gradients.
Think holistically — match the feeling. Use individual set_style ops for theme properties:

"space vibe" → dark blue bg, light blue primary, sci-fi font, float animations, glow hover
{"op":"set_style","path":"theme/mode","value":"dark"}
{"op":"set_style","path":"theme/backgroundColor","value":"#0a0a1a"}
{"op":"set_style","path":"theme/primaryColor","value":"#60a5fa"}
{"op":"set_style","path":"theme/textColor","value":"#e0e7ff"}
{"op":"set_style","path":"theme/fontFamily","value":"Orbitron"}
+ set animate:"float" on KPIs, animate:"glow" on charts, add styleHover with glow boxShadow

"gothic/elegant" → near-black bg, deep red primary, serif font (Cinzel), fadeIn + pulse, lift+shadow hover

"futuristic/cyber" → dark slate bg, cyan primary (#22d3ee), tech font (Rajdhani), shimmer + glow, neon border hover

"playful/fun" → warm bright bg (#fef3c7), orange primary, rounded font (Fredoka), bounce animations, scale-up hover

"minimalist" → light/white bg, neutral gray primary (#6b7280), sans-serif font (Inter), no animations (animate:"none"), subtle hover (slight opacity/color shift)

"minimal/clean" → same as minimalist — reduce visual noise, use whitespace, remove gradients, set all animations to "none"

Be creative with ANY aesthetic — interpret the mood and apply cohesive theme + font + animation + hover styles.

## GRADIENTS — WHEN & HOW
If a gradient would better match the vibe, prefer 3-5 color gradients for backgroundImage and a few component backgrounds; otherwise use solid colors.

GRADIENT DECISION:
1. NATURAL GRADIENT CONCEPTS (rainbow, sunset, sunrise, aurora, northern lights, ocean, fire, lava, sky):
   - These ARE gradients by nature → apply gradient to background AND most/all components
   - Use colors that authentically represent the concept (infer appropriate palette)
   - Components should each show gradient variations (different angles, color subsets)

2. BRANDS WITH GRADIENT IDENTITY (instagram, tiktok, or any brand known for gradient logos):
   - Gradient on theme/backgroundImage only
   - Components use SOLID colors from the brand palette (not gradients)
   - Pick 2-3 accent colors from brand identity for component backgrounds, borders, text

3. BRANDS WITHOUT GRADIENT IDENTITY (spotify, twitter, netflix, facebook):
   - Use solid backgroundColor (not gradient) matching brand
   - Components use brand accent colors as solids
   - Can use subtle gradients sparingly if it enhances the look

4. MOOD/VIBE WORDS (vibrant, dreamy, energetic, psychedelic, neon, holographic):
   - Judge if gradient fits the mood — prefer gradient for colorful/dynamic moods
   - Use solid for calm/minimal/corporate moods

GRADIENT CONSTRUCTION:
- Pick a palette of 3-5 colors that matches the vibe/brand/concept
- Use linear-gradient or radial-gradient CSS syntax
- Vary angles per component for visual interest (45deg, 135deg, 180deg, -45deg)

SUBCOMPONENT VARIETY:
- Derive 3-5 colors from the requested vibe/brand
- Distribute colors across components (each component can have different accent)
- Charts: set seriesColors[] with multiple palette colors
- Tables: headerBackgroundColor, rowStripeColor from palette
- KPIs: vary background or border color per KPI

VIBE REQUEST SCOPE:
1. GLOBAL VIBE (no specific component mentioned): "make it look like X", "X vibe", "X style", "X aesthetic"
   - Affects ENTIRE dashboard: theme + ALL components + ALL animations
   - Must reset/update animations to match new vibe (remove old animations if they don't fit)
   - Example: "make it look like netflix" → restyle theme AND every component AND reset animations

2. TARGETED VIBE (specific component mentioned): "make THE TABLE look like X", "give the chart X vibe"
   - Affects ONLY the mentioned component(s)
   - Do NOT touch theme or other components
   - Example: "make the table have a sunset vibe" → only restyle that table

3. EXCLUSIONS ("but keep X", "except X", "don't change X"):
   - Apply vibe globally EXCEPT to the explicitly excluded component(s)
   - Example: "make it look like ocean but keep the table" → restyle everything except table

FULL STYLE TRANSITIONS:
When user requests a new vibe/style (global), ALWAYS update:
- theme (mode, backgroundColor/backgroundImage, primaryColor, textColor, fontFamily)
- ALL component styles (backgrounds, borders, text colors)
- ALL component animations (set animate:"none" or a fitting animation — do NOT leave old animations)
- Chart seriesColors and chartTheme
- Table colors (header, stripes, dividers, row backgrounds)
- styleHover effects (update or remove to match new vibe)
This ensures switching from one style to another fully transforms the dashboard with no leftover styles.

## COLUMNS DISAMBIGUATION
"two columns" (layout) → {"op":"update","path":"layout/columns","value":2}
"table in 2 columns" (split data) → {"op":"update","path":"components[id=table1]/props/dataColumns","value":2}
"show only title, price" (fields) → {"op":"update","path":"components[id=table1]/props/columns","value":["title","price"]}

## RULES
1. TEXT props.content = exact text string
2. PIE/BAR by category: dataSource="/api/data", xField:"category"
3. KPIs: no height, always dataSource="/api/data"
4. Images: only user-provided URLs
5. "at top": add_component then reorder to newIndex:0
6. Only reference existing component IDs
7. Vibe/brand requests: FULLY restyle theme AND ALL components (use gradient decision rules above)
8. AVOID: position:fixed/absolute, zIndex>100
9. UNIQUE IDs: When adding multiple components, use unique IDs (pie1, pie2, bar1, bar2, kpi1, kpi2, etc.)
10. TEXT CONTRAST: When setting background colors, ensure text remains readable. Dark bg → light text, light bg → dark text. Avoid low-contrast combinations.
11. TABLE HOVER: Do NOT use scale/zoom transforms on tables — they crop content. Use subtle effects like background color change, border glow, or translateY instead.`

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

  // Add existing component IDs to help AI generate unique IDs
  const existingIds = currentSchema.components.map(c => c.id)
  if (existingIds.length > 0) {
    userPrompt += `\n\nExisting component IDs (use different IDs for new components): ${existingIds.join(', ')}`
  }
    
  // Detect targeted component requests (e.g., "make the table red", "chart text blue", "kpi text red")
  const componentTypeMatches = processedPrompt.toLowerCase().match(/\b(the\s+)?(table|chart|kpi|text|image|pie|bar|line|area|scatter|radar)\b/)
  if (componentTypeMatches) {
    // Find actual component ID matching the type mentioned
    const mentionedType = componentTypeMatches[2]
    const typeMapping: Record<string, string[]> = {
      'table': ['table'],
      'chart': ['chart', 'pie_chart', 'bar_chart', 'line_chart', 'area_chart', 'scatter_chart', 'radar_chart'],
      'pie': ['pie_chart'],
      'bar': ['bar_chart'],
      'line': ['line_chart'],
      'area': ['area_chart'],
      'scatter': ['scatter_chart'],
      'radar': ['radar_chart'],
      'kpi': ['kpi'],
      'text': ['text'],
      'image': ['image']
    }
    const targetTypes = typeMapping[mentionedType] || [mentionedType]
    const targetIds = currentSchema.components
      .filter(c => targetTypes.includes(c.type) || c.id.toLowerCase().includes(mentionedType))
      .map(c => c.id)
    
    if (targetIds.length > 0) {
      userPrompt += `\n\nTARGETED REQUEST: Only affect component(s): ${targetIds.join(', ')}`
      
      // Add KPI-specific styling guidance
      if (mentionedType === 'kpi') {
        userPrompt += `\nIMPORTANT: For KPI text styling, use labelColor and valueColor properties. Do NOT use 'color'.`
      }
    }
  }
    
  // Add URL placeholder mapping
    if (urlPlaceholderMap.size > 0) {
    userPrompt += `\n\nImage placeholders: ${Array.from(urlPlaceholderMap.keys()).join(', ')} (use these in src field)`
  }

  // Handle uploaded images
  if (isAddImageIntent) {
    // Find the next available image ID by checking existing components
    const existingImageIds = currentSchema.components
      .filter(c => c.id.startsWith('img'))
      .map(c => {
        const match = c.id.match(/^img(\d+)$/)
        return match ? parseInt(match[1], 10) : 0
      })
    const maxExistingId = existingImageIds.length > 0 ? Math.max(...existingImageIds) : 0
    
    userPrompt += `\n\nUser uploaded ${uploadedImages.length} image(s) to ADD as components.`
    uploadedImages.forEach((_, index) => {
        const placeholder = `[UPLOADED_IMAGE_${index + 1}]`
      urlPlaceholderMap.set(placeholder, uploadedImages[index])
      const newImageId = maxExistingId + index + 1
      userPrompt += `\nCreate add_component for image ${index + 1}: id="img${newImageId}", src="${placeholder}"`
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
    // List all existing component IDs for explicit styling
    const componentIds = currentSchema.components.map(c => c.id)
    userPrompt += `\n\nApply these EXACT colors to theme and ALL components. Do NOT add image components.`
    userPrompt += `\nGenerate set_style operations for EACH of these components: ${componentIds.join(', ')}`
    userPrompt += `\nFor charts (bar_chart, pie_chart, line_chart, etc): set backgroundColor, color (for chart lines/bars)`
    userPrompt += `\nFor KPIs: set backgroundColor, color, valueColor, labelColor`
    userPrompt += `\nFor tables: set backgroundColor, color, headerBackgroundColor, headerTextColor`
    userPrompt += `\nFor text: set color`
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
      max_tokens: 4000,
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

  // Helper: extract component ID from path like "components[id=kpi1]/style/color"
  const extractComponentId = (path: string): string | null => {
    const match = path.match(/\[id=([^\]]+)\]/)
    return match ? match[1] : null
  }
  
  // Helper: check if a component is a KPI by ID
  const isKpiComponent = (id: string): boolean => {
    const component = currentSchema.components.find(c => c.id === id)
    return component?.type === 'kpi'
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
            
            // Convert 'color' to 'labelColor' and 'valueColor' for KPIs
            const componentId = extractComponentId(path)
            if (componentId && isKpiComponent(componentId) && path.endsWith('/style/color')) {
              const basePath = path.replace('/style/color', '')
              validatedOperations.push({ op: 'set_style', path: `${basePath}/style/labelColor`, value })
              validatedOperations.push({ op: 'set_style', path: `${basePath}/style/valueColor`, value })
              break
            }
            
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
            
            // Convert 'color' to 'labelColor' and 'valueColor' for KPIs in update ops too
            const componentId = extractComponentId(path)
            if (componentId && isKpiComponent(componentId) && path.endsWith('/style/color')) {
              const basePath = path.replace('/style/color', '')
              validatedOperations.push({ op: 'update', path: `${basePath}/style/labelColor`, value })
              validatedOperations.push({ op: 'update', path: `${basePath}/style/valueColor`, value })
              break
            }
            
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

  // Auto-inject reorder operations when prompt says "at top", "on top" or "at beginning"
  const wantsAtTop = /\b((at|on)\s+(the\s+)?(top|beginning|start)|^add.*first)\b/i.test(prompt)
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
