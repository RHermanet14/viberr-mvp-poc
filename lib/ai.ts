import Groq from 'groq-sdk'
import { DesignSchema, Operation, Component } from './schema'
import { getOptimizedSchema, isVagueRequest } from './schemaOptimizer'

// Analyze prompt to determine which guidance blocks are needed
function analyzePromptIntent(prompt: string): {
  isReorder: boolean
  isAddKpi: boolean
  isAddChart: boolean
  isAddImage: boolean
  isAddTable: boolean
  isAddText: boolean
  isRemove: boolean
  isFontStyle: boolean
  isColorStyle: boolean
  isFilterSort: boolean
  isTheme: boolean
  isLayout: boolean
  needsReorderGuidance: boolean
  needsKpiGuidance: boolean
  needsChartGuidance: boolean
  needsImageGuidance: boolean
  needsTopNGuidance: boolean
  needsFontGuidance: boolean
  needsPieChartGuidance: boolean
} {
  const lower = prompt.toLowerCase()
  
  // Detect operation types
  const isReorder = /\b(move|reorder|to top|to the top|to front|to the front|at top|at the top|to beginning|to the beginning)\b/i.test(prompt)
  const isAddKpi = /\b(add|create|insert|show|display).*(kpi|total items|avg price|average price|count|sum)\b/i.test(prompt) || 
                   (/\b(kpi|total items|avg price|average price|count|sum)\b/i.test(prompt) && /\b(add|create|insert|show|display)\b/i.test(prompt))
  const isAddChart = /\b(add|create|insert|show|display).*(chart|pie chart|bar chart|line chart|area chart)\b/i.test(prompt) ||
                     (/\b(chart|pie chart|bar chart|line chart|area chart)\b/i.test(prompt) && /\b(add|create|insert|show|display)\b/i.test(prompt))
  const isAddImage = /\b(add|create|insert|show|display).*(image|picture|photo|img)\b/i.test(prompt)
  const isAddTable = /\b(add|create|insert|show|display).*(table)\b/i.test(prompt)
  const isAddText = /\b(add|create|insert|show|display).*(text|heading|title)\b/i.test(prompt)
  const isRemove = /\b(remove|delete|hide|get rid of)\b/i.test(prompt)
  const isFontStyle = /\b(font|typeface|typography|text style|gothic|elegant|modern|bold|classic|futuristic|handwritten|serif|sans-serif|monospace|script|decorative|minimal|clean|fancy|formal|casual|playful|serious|tech|retro|vintage|artistic|minimalist)\b/i.test(prompt)
  const isColorStyle = /\b(color|background|border|shadow|padding|margin|size|bigger|smaller)\b/i.test(prompt) && !isFontStyle
  const isFilterSort = /\b(sort|filter|top \d+|show only top|by price|by date|ascending|descending)\b/i.test(prompt)
  const isTheme = /\b(dark mode|light mode|theme|background color|primary color)\b/i.test(prompt) && !isVagueRequest(prompt)
  const isLayout = /\b(columns|layout|two column|three column|grid)\b/i.test(prompt)
  
  // Determine which guidance blocks are needed
  const needsReorderGuidance = isReorder || (/\b(at top|at the top|on top|to top|to the top|to front|to the front)\b/i.test(prompt) && (isAddKpi || isAddChart || isAddImage || isAddTable || isAddText))
  const needsKpiGuidance = isAddKpi
  const needsChartGuidance = isAddChart
  const needsImageGuidance = isAddImage
  const needsTopNGuidance = isFilterSort || /\b(top \d+|show only top \d+|only top \d+)\b/i.test(prompt)
  const needsFontGuidance = isFontStyle || (isVagueRequest(prompt) && /\b(font|typeface|typography)\b/i.test(prompt))
  const needsPieChartGuidance = isAddChart && /\b(pie chart|chart).*by category|by category.*(pie|chart)\b/i.test(prompt)
  
  return {
    isReorder,
    isAddKpi,
    isAddChart,
    isAddImage,
    isAddTable,
    isAddText,
    isRemove,
    isFontStyle,
    isColorStyle,
    isFilterSort,
    isTheme,
    isLayout,
    needsReorderGuidance,
    needsKpiGuidance,
    needsChartGuidance,
    needsImageGuidance,
    needsTopNGuidance,
    needsFontGuidance,
    needsPieChartGuidance,
  }
}

const groq = process.env.GROQ_API_KEY ? new Groq({
  apiKey: process.env.GROQ_API_KEY,
}) : null

const SYSTEM_PROMPT = `You are UI Design Ops. Edit dashboard schema via JSON operations only.

CONSTRAINTS
- Only presentation: layout, components, styles, sorting/filtering. Never backend/data/auth/API/db.
- Ops: set_style, update, add_component, remove_component, move_component, replace_component, reorder_component.
- Max 30 components. Vague requests: max 15 ops.
- Output: { "operations": [...] } JSON only. No markdown/explanations.

COMPONENTS
Types: table, chart, kpi, text, image, pie_chart, bar_chart, line_chart, area_chart, scatter_chart, radar_chart, histogram, composed_chart
Props:
- Tables: dataSource, columns (array like ["id","title","price"]), dataColumns (1-4). Tables automatically display images if data contains image URLs.
- Charts: dataSource, chartType, xField, yField, color, aggregateFunction ("count"|"sum"|"avg")
- KPIs: dataSource, field, label, calculation ("sum"|"avg"|"count"|"min"|"max"), format ("currency")
- Text: content, heading
- Images: src (required, user-provided URL only), alt (alt text), objectFit (default "contain" in style), objectPosition (position string), lazy (boolean, default true)
- CRITICAL for Images: ONLY use URLs that the user explicitly provides in their request. NEVER generate, create, or invent image URLs. If user requests an image without providing a URL, DO NOT create an image component.

STYLES (apply via set_style or component.style)
Typography: fontSize, fontFamily, fontWeight, fontStyle, textAlign, textDecoration, letterSpacing, lineHeight, wordSpacing, textTransform, whiteSpace
Colors: color, backgroundColor, textColor, borderColor, headerBackgroundColor, headerTextColor, valueColor, labelColor, rowHoverColor
Backgrounds: backgroundImage (url('...'), linear-gradient(...), radial-gradient(...)), backgroundSize, backgroundPosition, backgroundRepeat
Effects: backdropFilter, filter, blur, brightness, contrast, saturate, opacity, boxShadow, textShadow
Layout: width, height, minWidth, minHeight, maxWidth, maxHeight, padding, margin, gap
Borders: border, borderWidth, borderRadius, borderStyle, borderColor
Display: display, flexDirection, alignItems, justifyContent, objectFit, objectPosition
Transitions: transition, transitionDuration, transitionTimingFunction
Advanced: transform, cursor, pointerEvents, userSelect, outline, outlineOffset, overflowWrap, wordBreak, zIndex

FONTS: Use Google Fonts names: "Roboto", "Montserrat", "Open Sans", "Lato", "Poppins", "Raleway", "Oswald", "Playfair Display", "Merriweather", "Bebas Neue", "Dancing Script", etc.
System fonts: "system-ui", "sans-serif", "serif", "monospace"
Font style mappings: "gothic"→"Oswald"/"Bebas Neue", "elegant"→"Playfair Display"/"Merriweather", "modern"→"Roboto"/"Montserrat", "handwritten"→"Dancing Script", "bold"→"Bebas Neue"/"Oswald", "classic"→"Times New Roman"/"serif", "futuristic"→"Orbitron"/"Rajdhani"
If user describes a font style (e.g., "gothic", "elegant", "modern"), map to appropriate Google Font name.

DATA SOURCES
- "/api/data": Raw items (id, title, category, price, date). Use for: KPIs, tables, charts by category/field.
- "/api/data/summary": Time series (month, total, count, avgPrice). DEFAULT for charts unless grouping by field.

RULES
- Charts default: dataSource="/api/data/summary", xField="month", yField="total"
- "pie chart by category" or "chart by category": ADD a new pie chart component (don't reference existing)
- "by category": means ADD chart with dataSource="/api/data", xField="category", aggregateFunction="count"
- KPIs: ALWAYS include dataSource="/api/data", calculation ("count"/"avg"/"sum"), field ("price" if avg/sum), label
- "KPIs at top" or "KPIs at the top": After adding KPIs, use reorder_component to move them to newIndex 0, 1, etc. (move to beginning)
- Sorting: "filters/sortBy" and "filters/sortOrder", NOT props.columns
- "top 10" or "show only top 10": Set "filters/limit" to 10 AND "filters/sortBy" to "price", "filters/sortOrder" to "desc" (highest price by default)
- Filtering: "filters/limit" (number) limits table rows. "top N" means limit N rows sorted by price descending.
- Paths: "theme/mode", "layout/columns", "components[id=X]/style/Y", "filters/sortBy", "filters/sortOrder", "filters/limit"
- CRITICAL: Always include dataSource for charts/KPIs - never omit it. KPIs without dataSource won't show data.

VAGUE REQUESTS ("like X")
1. Identify brand, PRIMARY UI COLOR (buttons/CTAs, not logo), theme mode, layout
2. Generate operations in order:
   a) Theme: mode, backgroundColor, primaryColor, textColor, borderColor, cardBackgroundColor
   b) Layout: columns, cardStyle
   c) Apply theme colors to ALL existing components:
      - Charts: set style.color to primaryColor
      - Tables: set style.textColor to textColor (or primaryColor)
      - KPIs: set style.valueColor to textColor (or primaryColor), style.backgroundColor to cardBackgroundColor
3. Limit to 15 operations for vague requests (to prevent timeouts). Examples: Netflix #e50914, Spotify #1db954
4. For each existing component, add set_style operations to apply theme colors

EXAMPLES
Add chart: {"operations":[{"op":"add_component","component":{"id":"bar1","type":"bar_chart","props":{"dataSource":"/api/data/summary","xField":"month","yField":"total"},"style":{"width":"100%","height":"400px"}}}]}
Add KPI: {"operations":[{"op":"add_component","component":{"id":"kpi1","type":"kpi","props":{"dataSource":"/api/data","calculation":"count","label":"Total Items"},"style":{"width":"100%"}}}]}
Add image (user provided URL): {"operations":[{"op":"add_component","component":{"id":"img1","type":"image","props":{"src":"[IMAGE_URL_1]","alt":"Description"},"style":{"width":"100%","height":"300px","borderRadius":"8px","objectFit":"contain"}}}]}
Two-column with KPIs at top: {"operations":[{"op":"update","path":"layout/columns","value":2},{"op":"add_component","component":{"id":"kpi1","type":"kpi","props":{"dataSource":"/api/data","calculation":"count","label":"Total Items"},"style":{"width":"100%"}}},{"op":"add_component","component":{"id":"kpi2","type":"kpi","props":{"dataSource":"/api/data","calculation":"avg","field":"price","label":"Avg Price"},"style":{"width":"100%"}}},{"op":"reorder_component","id":"kpi1","newIndex":0},{"op":"reorder_component","id":"kpi2","newIndex":1}]}
Dark mode: {"operations":[{"op":"set_style","path":"theme/mode","value":"dark"},{"op":"set_style","path":"theme/backgroundColor","value":"#141414"}]}
Change font: {"operations":[{"op":"set_style","path":"theme/fontFamily","value":"Roboto"},{"op":"set_style","path":"components[id=table1]/style/fontFamily","value":"Montserrat"}]}
Background image: {"operations":[{"op":"set_style","path":"components[id=kpi1]/style/backgroundImage","value":"url('https://example.org/real-background.jpg')"},{"op":"set_style","path":"components[id=kpi1]/style/backgroundSize","value":"cover"}]}
Gradient background: {"operations":[{"op":"set_style","path":"components[id=text1]/style/backgroundImage","value":"linear-gradient(to right, #667eea, #764ba2)"}]}
Advanced typography: {"operations":[{"op":"set_style","path":"components[id=text1]/style/letterSpacing","value":"0.1em"},{"op":"set_style","path":"components[id=text1]/style/lineHeight","value":"1.8"},{"op":"set_style","path":"components[id=text1]/style/textTransform","value":"uppercase"}]}
Reorder: {"operations":[{"op":"update","path":"layout/columns","value":1},{"op":"reorder_component","id":"chart1","newIndex":0}]}
Sort: {"operations":[{"op":"update","path":"filters/sortBy","value":"price"},{"op":"update","path":"filters/sortOrder","value":"desc"}]}
Top 10: {"operations":[{"op":"update","path":"filters/sortBy","value":"price"},{"op":"update","path":"filters/sortOrder","value":"desc"},{"op":"update","path":"filters/limit","value":10}]}
Add pie chart by category: {"operations":[{"op":"add_component","component":{"id":"pie1","type":"pie_chart","props":{"dataSource":"/api/data","xField":"category","aggregateFunction":"count"},"style":{"width":"100%","height":"400px"}}}]}
Netflix style: {"operations":[{"op":"set_style","path":"theme/mode","value":"dark"},{"op":"set_style","path":"theme/backgroundColor","value":"#141414"},{"op":"set_style","path":"theme/primaryColor","value":"#e50914"},{"op":"set_style","path":"theme/textColor","value":"#ffffff"},{"op":"set_style","path":"theme/cardBackgroundColor","value":"#1f1f1f"},{"op":"set_style","path":"components[id=chart1]/style/color","value":"#e50914"},{"op":"set_style","path":"components[id=table1]/style/textColor","value":"#e50914"},{"op":"set_style","path":"components[id=kpi1]/style/valueColor","value":"#e50914"},{"op":"set_style","path":"components[id=kpi1]/style/backgroundColor","value":"#1f1f1f"}]}`.trim();

export async function generateDesignOperations(
  prompt: string,
  currentSchema: DesignSchema
): Promise<Operation[]> {
  try {
    // Optimize schema based on prompt context
    const optimizedSchema = getOptimizedSchema(currentSchema, prompt)
    
    // Compress JSON (no formatting, remove nulls already handled in optimizer)
    const schemaJson = JSON.stringify(optimizedSchema)
    
    // Detect vague requests for operation limiting
    const vague = isVagueRequest(prompt)
    const timeoutMs = 10000 // Fixed 10s timeout
    
    // If schema is too large, be more aggressive with optimization
    let finalSchemaJson = schemaJson
    const schemaSize = new Blob([schemaJson]).size
    if (schemaSize > 8000) { // ~2000 tokens
      // Send only essential info
      const minimalSchema = {
        theme: optimizedSchema.theme,
        layout: optimizedSchema.layout,
        components: optimizedSchema.components.map((c: Component) => ({
          id: c.id,
          type: c.type,
        })),
      }
      const minimalJson = JSON.stringify(minimalSchema)
      const minimalSize = new Blob([minimalJson]).size
      if (minimalSize < schemaSize * 0.5) {
        finalSchemaJson = minimalJson
      }
    }
    
    // Detect multiple intents in prompt
    const hasMultipleIntents = /\b(then|and|also|plus|,)\b/i.test(prompt)
    const intents = hasMultipleIntents 
      ? prompt.split(/\b(then|and|also|plus|,)\b/i).map(s => s.trim()).filter(s => s.length > 0)
      : [prompt]
    
    // Extract URLs from prompt to handle long URLs (including data URLs)
    // Store full URLs separately and remove from prompt to save tokens
    // Match both http/https URLs and data URLs (data:image/...;base64,...)
    const httpUrlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
    // Data URL regex: matches data:image/[type];base64,[base64data] - base64 can include = padding
    const dataUrlRegex = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi
    const httpUrls = (prompt.match(httpUrlRegex) || []).map(url => url.trim())
    const dataUrls = (prompt.match(dataUrlRegex) || []).map(url => url.trim())
    const extractedUrls = [...httpUrls, ...dataUrls]
    
    const urlMap = new Map<number, string>()
    const urlPlaceholderMap = new Map<string, string>() // Maps placeholder -> full URL
    
    // Remove URLs from prompt and replace with placeholders to save tokens
    let processedPrompt = prompt
    if (extractedUrls.length > 0) {
      extractedUrls.forEach((url, index) => {
        urlMap.set(index, url)
        const placeholder = `[IMAGE_URL_${index + 1}]`
        urlPlaceholderMap.set(placeholder, url)
        // Replace the URL in the prompt with placeholder (escape special regex characters)
        const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        processedPrompt = processedPrompt.replace(new RegExp(escapedUrl, 'g'), placeholder)
      })
    }
    
    // Analyze prompt intent to determine which guidance blocks are needed
    const intent = analyzePromptIntent(processedPrompt)
    
    // Build user prompt - URLs are now placeholders
    let userPrompt = `Current schema: ${finalSchemaJson}

User request: ${processedPrompt}`
    
    // Add URL mapping if we have URLs (but don't include full URLs - just tell AI to use placeholders)
    if (urlPlaceholderMap.size > 0) {
      userPrompt += `\n\nNOTE: The request contains image URLs that have been replaced with placeholders. When creating image components, use these placeholders in the "src" field: ${Array.from(urlPlaceholderMap.keys()).join(', ')}. The placeholders will be automatically replaced with the actual URLs.`
    }

    // Add multi-intent handling
    if (hasMultipleIntents && intents.length > 1) {
      userPrompt += `\n\nNOTE: This request contains ${intents.length} operations. Process ALL of them:\n${intents.map((intent, i) => `${i+1}. ${intent}`).join('\n')}`
    }

    // Add chain-of-thought for vague requests (only if vague)
    if (vague) {
      userPrompt += `\n\nTHINK STEP (internal, don't output in response):
1. What brand/service is mentioned? Identify it.
2. What is this brand's PRIMARY UI COLOR? (The color used for buttons/CTAs in their app, NOT logo colors)
3. What is the typical theme mode? (dark/light)
4. What layout characteristics? (card-based, minimal, etc.)

CRITICAL: After setting theme colors, you MUST apply them to ALL existing components:
- For each chart component: add {"op":"set_style","path":"components[id=COMPONENT_ID]/style/color","value":"[primaryColor]"}
- For each table component: add {"op":"set_style","path":"components[id=COMPONENT_ID]/style/textColor","value":"[textColor or primaryColor]"}
- For each KPI component: add {"op":"set_style","path":"components[id=COMPONENT_ID]/style/valueColor","value":"[textColor or primaryColor]"} AND {"op":"set_style","path":"components[id=COMPONENT_ID]/style/backgroundColor","value":"[cardBackgroundColor]"}

Now generate operations based on this analysis. Limit to 15 operations maximum. Focus on key style elements.`
    }
    
    // Add guidance ONLY for operations that are actually needed (based on intent analysis)
    
    // Reorder guidance - needed for reorder operations or when "at top" is mentioned with add operations
    if (intent.needsReorderGuidance) {
      if (intent.isAddKpi && /\b(kpi|kpis).*(at top|at the top|on top)\b/i.test(processedPrompt)) {
        userPrompt += `\n\nNOTE: "KPIs at top" means after adding KPIs, use reorder_component operations to move them to the beginning (newIndex: 0, 1, etc.).`
      } else if (intent.isReorder) {
        userPrompt += `\n\nNOTE: To move a component to the top/front, use reorder_component with newIndex: 0. To move to a specific position, use the appropriate newIndex.`
      } else if (/\b(at top|at the top|on top|to top|to the top|to front|to the front)\b/i.test(processedPrompt)) {
        userPrompt += `\n\nNOTE: After adding the component, use reorder_component to move it to the beginning (newIndex: 0).`
      }
    }
    
    // KPI guidance - only needed when adding KPIs
    if (intent.needsKpiGuidance) {
      userPrompt += `\n\nNOTE: When adding KPIs, ALWAYS include dataSource="/api/data". Without dataSource, KPIs will be empty. Include calculation ("count"/"avg"/"sum"), field ("price" if avg/sum), and label.`
    }
    
    // Chart guidance - only needed when adding charts
    if (intent.needsChartGuidance) {
      userPrompt += `\n\nNOTE: Charts default to dataSource="/api/data/summary", xField="month", yField="total". For charts by category/field, use dataSource="/api/data" with xField="category" and aggregateFunction="count".`
    }
    
    // Pie chart by category guidance - only needed when adding pie charts by category
    if (intent.needsPieChartGuidance) {
      userPrompt += `\n\nNOTE: "pie chart by category" means ADD a new pie chart component. Do not reference existing pie chart components. Use dataSource="/api/data", xField="category", aggregateFunction="count".`
    }
    
    // Top N table filtering guidance - only needed when filtering/sorting tables
    if (intent.needsTopNGuidance) {
      userPrompt += `\n\nNOTE: "top N" means filter the table to show only N rows. Set filters/limit to N, filters/sortBy to "price", and filters/sortOrder to "desc" (highest price first). Do NOT add horizontal scrolling or change table layout.`
    }
    
    // Font guidance - only needed when changing fonts or in vague requests that might need fonts
    if (intent.needsFontGuidance) {
      userPrompt += `\n\nNOTE: Font style interpretation:
- "gothic" or "bold decorative" → Use "Oswald" or "Bebas Neue" (bold, impactful)
- "elegant" or "classic" → Use "Playfair Display" or "Merriweather" (serif, elegant)
- "modern" or "clean" or "minimal" → Use "Roboto" or "Montserrat" (sans-serif, modern)
- "handwritten" or "script" or "fancy" → Use "Dancing Script" or "Pacifico" (cursive, decorative)
- "futuristic" or "tech" → Use "Orbitron" or "Rajdhani" (geometric, tech)
- "formal" or "serious" → Use "Merriweather" or "Lora" (serif, formal)
- "playful" or "casual" → Use "Comfortaa" or "Nunito" (rounded, friendly)
- "retro" or "vintage" → Use "Bebas Neue" or "Oswald" (bold, retro)
Always use actual Google Font names, not style descriptions.`
    }
    
    // Image guidance - only needed when adding images
    if (intent.needsImageGuidance) {
      if (extractedUrls.length === 0) {
        userPrompt += `\n\nCRITICAL: User requested an image but provided no URL. DO NOT create an image component.`
      }
    }

    userPrompt += `\n\nCRITICAL: Return ONLY valid JSON. Start with { and end with }. No markdown, no code blocks, no explanations.
Return format: { "operations": [...] }`

    // Calculate total token estimate AFTER all content is added
    // Use very conservative estimate: ~2.5 chars per token to account for tokenization overhead
    const systemPromptSize = new Blob([SYSTEM_PROMPT]).size
    const userPromptSize = new Blob([userPrompt]).size
    const totalSize = systemPromptSize + userPromptSize
    const totalTokens = Math.round(totalSize / 2.5) // Very conservative: 2.5 chars per token
    
    // If total is too large, use a condensed system prompt
    // Groq limit is 6000 tokens, so we use 5500 as threshold to leave buffer
    let finalSystemPrompt = SYSTEM_PROMPT
    let finalUserPrompt = userPrompt
    if (totalTokens > 5500) { // Increased threshold: 5500 (was 4000) - only condense when truly necessary
      // Condensed system prompt - remove examples and shorten descriptions
      finalSystemPrompt = `UI Design Ops. Edit dashboard via JSON ops only.

CONSTRAINTS: Presentation only. Ops: set_style, update, add_component, remove_component, move_component, replace_component, reorder_component. Max 30 components. Output: {"operations":[...]} JSON only. CRITICAL: Each operation MUST have "op" field (not "type").

COMPONENTS: table, chart, kpi, text, image, pie_chart, bar_chart, line_chart, area_chart, scatter_chart, radar_chart, histogram, composed_chart
Props: Tables: dataSource, columns. Charts: dataSource, chartType, xField, yField, aggregateFunction. KPIs: dataSource, field, label, calculation. Text: content. Images: src (required), alt. Default objectFit="contain" (set in style, not props).
CRITICAL Images: Only use URLs user provides. Never generate placeholders. If no URL provided, don't create image component.

STYLES: fontSize, fontFamily, fontWeight, color, backgroundColor, textColor, borderColor, padding, margin, border, borderRadius, boxShadow, backgroundImage, objectFit, etc.

DATA: "/api/data" for KPIs/tables/charts by field. "/api/data/summary" DEFAULT for charts.

RULES: Charts default: dataSource="/api/data/summary", xField="month", yField="total". "by category": ADD chart with dataSource="/api/data", xField="category", aggregateFunction="count". KPIs: ALWAYS include dataSource="/api/data". "KPIs at top": After adding, use reorder_component to move to newIndex 0,1. "top N": Set filters/limit=N, filters/sortBy="price", filters/sortOrder="desc". Paths: "theme/mode", "layout/columns", "components[id=X]/style/Y", "filters/sortBy", "filters/sortOrder", "filters/limit".

VAGUE REQUESTS: Identify brand, PRIMARY UI COLOR (#hex), theme mode (dark/light). Generate: 1) Theme colors (mode, backgroundColor, primaryColor, textColor, cardBackgroundColor), 2) Apply to ALL components (charts→style.color, tables→style.textColor, KPIs→style.valueColor+backgroundColor). Limit 15 ops. Examples: Netflix #e50914 dark, Spotify #1db954 dark.

FORMAT: {"operations":[{"op":"add_component","component":{"id":"img1","type":"image","props":{"src":"[IMAGE_URL_1]"}}}]}`
      
      // Always reduce user prompt when we condense system prompt to be safe
      // Remove verbose guidance, keep only essential
      finalUserPrompt = `Schema: ${finalSchemaJson}\n\nRequest: ${processedPrompt}`
      
      // Preserve vague request guidance even when condensing
      if (vague) {
        finalUserPrompt += `\n\nVAGUE REQUEST: Identify brand, PRIMARY UI COLOR (#hex), theme mode (dark/light). Set theme colors (mode, backgroundColor, primaryColor, textColor, cardBackgroundColor), then apply to ALL components: charts→style.color, tables→style.textColor, KPIs→style.valueColor+backgroundColor. Limit 15 ops.`
      }
      
      if (urlPlaceholderMap.size > 0) {
        finalUserPrompt += `\n\nUse placeholders in src: ${Array.from(urlPlaceholderMap.keys()).join(', ')}`
      }
      if (extractedUrls.length === 0 && /\b(add|create|insert|show|display).*(image|picture|photo|img)\b/i.test(processedPrompt)) {
        finalUserPrompt += `\n\nNo image URL provided. Don't create image component.`
      }
      finalUserPrompt += `\n\nReturn JSON: {"operations":[...]}`
    } else {
      finalUserPrompt = userPrompt
    }

    if (!groq) {
      throw new Error('No AI provider configured. Please set GROQ_API_KEY in your environment variables')
    }
    
    const completion = await Promise.race([
      groq.chat.completions.create({
        model: 'llama-3.1-8b-instant', // Fast and efficient Groq model
        messages: [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: finalUserPrompt },
        ],
        temperature: 0.2, // Lower temperature for faster, more consistent JSON output
        response_format: { type: 'json_object' },
        max_tokens: vague ? 2000 : 1500, // Limit tokens for all requests to prevent timeouts
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs/1000}s`)), timeoutMs)
      ),
    ])

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI. Please try again.')
    }

    // Clean and parse JSON with multiple fallback strategies
    let parsed: any
    let operations: any[] = []
    
    try {
      // Strategy 1: Direct JSON parse
      parsed = JSON.parse(content.trim())
      operations = Array.isArray(parsed) ? parsed : parsed.operations || []
    } catch (parseError) {
      // Strategy 2: Remove markdown code fences if present
      let cleaned = content.trim()
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
      
      try {
        parsed = JSON.parse(cleaned)
        operations = Array.isArray(parsed) ? parsed : parsed.operations || []
      } catch {
        // Strategy 3: Extract JSON object from text
        const jsonObjectMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonObjectMatch) {
          try {
            parsed = JSON.parse(jsonObjectMatch[0])
            operations = Array.isArray(parsed) ? parsed : parsed.operations || []
          } catch {
            // Strategy 4: Extract JSON array
            const jsonArrayMatch = cleaned.match(/\[[\s\S]*\]/)
            if (jsonArrayMatch) {
              try {
                operations = JSON.parse(jsonArrayMatch[0])
              } catch {
                throw new Error('Failed to parse JSON response. The AI returned invalid JSON. Please try rephrasing your request.')
              }
            } else {
              throw new Error('Failed to parse JSON response. The AI returned invalid JSON. Please try rephrasing your request.')
            }
          }
        } else {
          throw new Error('Failed to parse JSON response. The AI returned invalid JSON. Please try rephrasing your request.')
        }
      }
    }

    // Validate and sanitize operations
    const validOps = ['set_style', 'update', 'add_component', 'remove_component', 'move_component', 'replace_component', 'reorder_component']
    let validatedOperations: Operation[] = []

    for (const op of operations) {
      if (!op || typeof op !== 'object') {
        console.warn('Skipping invalid operation:', op)
        continue
      }

      // Handle both "op" and "type" fields (AI sometimes uses "type" instead of "op")
      const opType = op.op || op.type
      if (!opType || !validOps.includes(opType)) {
        console.warn('Skipping operation with invalid op type:', opType, 'Full op:', op)
        continue
      }

      // Validate operation structure based on type
      try {
        switch (opType) {
          case 'set_style':
            if (!op.path || op.value === undefined) {
              console.warn('Invalid set_style operation: missing path or value', op)
              continue
            }
            validatedOperations.push({ op: 'set_style', path: String(op.path), value: op.value })
            break

          case 'update':
            if (!op.path || op.value === undefined) {
              console.warn('Invalid update operation: missing path or value', op)
              continue
            }
            validatedOperations.push({ op: 'update', path: String(op.path), value: op.value })
            break

          case 'add_component':
            // Handle both op.component and direct component structure
            const component = op.component || op
            if (!component || !component.id || !component.type) {
              console.warn('Invalid add_component operation: missing component, id, or type', {
                hasComponent: !!op.component,
                hasDirectComponent: !!op,
                componentId: component?.id,
                componentType: component?.type,
                fullOp: op
              })
              continue
            }
            // Ensure component has required props structure
            const componentType = String(component.type)
            const allowedTypes = ['table', 'chart', 'kpi', 'text', 'image', 'pie_chart', 'bar_chart', 'line_chart', 'area_chart', 'scatter_chart', 'radar_chart', 'histogram', 'composed_chart'] as const
            if (!allowedTypes.includes(componentType as any)) {
              console.warn('Invalid component type:', componentType, 'Allowed types:', allowedTypes)
              continue
            }
            const validatedComponent: Component = {
              id: String(component.id),
              type: componentType as Component['type'],
              props: component.props || {},
              style: component.style || {},
            }
            
            // Reject image components with placeholder URLs
            // Replace placeholders with actual URLs from original prompt
            if (componentType === 'image') {
              const imageSrc = validatedComponent.props?.src
              if (imageSrc && typeof imageSrc === 'string') {
                let finalSrc = imageSrc
                
                // Replace placeholders with actual URLs
                if (urlPlaceholderMap.size > 0) {
                  // Check if src is a placeholder
                  if (urlPlaceholderMap.has(imageSrc)) {
                    finalSrc = urlPlaceholderMap.get(imageSrc)!
                  } else {
                    // Check if placeholder is embedded in the URL string
                    for (const [placeholder, fullUrl] of Array.from(urlPlaceholderMap.entries())) {
                      if (imageSrc.includes(placeholder)) {
                        finalSrc = imageSrc.replace(placeholder, fullUrl)
                        break
                      }
                    }
                    
                    // If still no match and we have extracted URLs, try reconstruction
                    if (finalSrc === imageSrc && urlMap.size > 0) {
                      // Check if this URL is a prefix of any extracted URL (AI might have truncated it)
                      if (imageSrc.length < 100 || (!imageSrc.startsWith('http') && !imageSrc.startsWith('data:'))) {
                        // Try to match against extracted URLs from original prompt
                        for (const [index, fullUrl] of Array.from(urlMap.entries())) {
                          const urlStart = imageSrc.replace(/\.\.\.$/, '').replace(/\[truncated\]/i, '').trim()
                          if (urlStart.length > 20 && fullUrl.startsWith(urlStart)) {
                            finalSrc = fullUrl
                            break
                          }
                        }
                      } else {
                        // Check if this is a partial match (AI might have cut off the end)
                        for (const [index, fullUrl] of Array.from(urlMap.entries())) {
                          if (fullUrl.startsWith(imageSrc) && fullUrl.length > imageSrc.length) {
                            finalSrc = fullUrl
                            break
                          }
                        }
                      }
                      
                      // Fallback: if only one URL was extracted and current src doesn't match, use the extracted one
                      if (urlMap.size === 1 && !extractedUrls.some(url => url === finalSrc || finalSrc.includes(url.substring(0, 50)))) {
                        const [firstUrl] = Array.from(urlMap.values())
                        if (firstUrl.length > finalSrc.length && firstUrl.startsWith(finalSrc.substring(0, Math.min(30, finalSrc.length)))) {
                          finalSrc = firstUrl
                        }
                      }
                    }
                  }
                }
                
                validatedComponent.props.src = finalSrc
                
                const lowerSrc = finalSrc.toLowerCase()
                const placeholderPatterns = [
                  'example.com',
                  'placeholder',
                  'via.placeholder.com',
                  'placehold.it',
                  'dummyimage.com',
                  'unsplash.com/photo-1234567890',
                  'images.unsplash.com/photo-1234567890',
                  'unsplash.com/photo-',
                  'images.unsplash.com/photo-',
                ]
                if (placeholderPatterns.some(pattern => lowerSrc.includes(pattern))) {
                  console.warn('Rejecting image component with placeholder URL:', finalSrc)
                  continue
                }
              }
              
              // Ensure objectFit defaults to 'contain' in style (not props) to show full image
              if (!validatedComponent.style) {
                validatedComponent.style = {}
              }
              if (!validatedComponent.style.objectFit) {
                validatedComponent.style.objectFit = 'contain'
              }
            }
            
            validatedOperations.push({ op: 'add_component', component: validatedComponent })
            break

          case 'remove_component':
            if (!op.id) {
              console.warn('Invalid remove_component operation: missing id', op)
              continue
            }
            validatedOperations.push({ op: 'remove_component', id: String(op.id) })
            break

          case 'replace_component':
            const replaceComponent = op.component || op
            if (!op.id || !replaceComponent || !replaceComponent.id || !replaceComponent.type) {
              console.warn('Invalid replace_component operation: missing id or component', op)
              continue
            }
            validatedOperations.push({ op: 'replace_component', id: String(op.id), component: replaceComponent })
            break

          case 'move_component':
            if (!op.id || !op.position || typeof op.position.x !== 'number' || typeof op.position.y !== 'number') {
              console.warn('Invalid move_component operation: missing id or position', op)
              continue
            }
            validatedOperations.push({
              op: 'move_component',
              id: String(op.id),
              position: {
                x: op.position.x,
                y: op.position.y,
                width: op.position.width,
                height: op.position.height,
              },
            })
            break

          case 'reorder_component':
            if (!op.id || typeof op.newIndex !== 'number') {
              console.warn('Invalid reorder_component operation: missing id or newIndex', op)
              continue
            }
            validatedOperations.push({ op: 'reorder_component', id: String(op.id), newIndex: op.newIndex })
            break
        }
      } catch (validationError) {
        console.warn('Error validating operation:', op, validationError)
        continue
      }
    }

    // Check if this was an image request without URL
    if (validatedOperations.length === 0) {
      const isImageRequest = /\b(add|create|insert|show|display).*(image|picture|photo|img)\b/i.test(prompt)
      const hasUrl = extractedUrls.length > 0
      
      if (isImageRequest && !hasUrl) {
        throw new Error('To add an image, please provide a complete image URL. Example: "add image with url https://example.com/image.jpg" or a data URL like "data:image/png;base64,..."')
      }
      
      if (operations.length > 0) {
        throw new Error('No valid operations found in AI response. Please try rephrasing your request.')
      }
    }

    // Limit operations for vague requests to prevent timeouts
    const maxOperations = vague ? 15 : 30
    
    if (validatedOperations.length > maxOperations) {
      console.warn(`Limiting operations from ${validatedOperations.length} to ${maxOperations} for ${vague ? 'vague' : 'complex'} request`)
      validatedOperations = validatedOperations.slice(0, maxOperations)
    }

    return validatedOperations
  } catch (error) {
    console.error('AI generation error:', error)
    throw error
  }
}
