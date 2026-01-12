import Groq from 'groq-sdk'
import { DesignSchema, Operation, Component } from './schema'
import { getOptimizedSchema, isVagueRequest } from './schemaOptimizer'

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
Types: table, chart, kpi, text, pie_chart, bar_chart, line_chart, area_chart, scatter_chart, radar_chart, histogram, composed_chart
Props:
- Tables: dataSource, columns (array like ["id","title","price"]), dataColumns (1-4)
- Charts: dataSource, chartType, xField, yField, color, aggregateFunction ("count"|"sum"|"avg")
- KPIs: dataSource, field, label, calculation ("sum"|"avg"|"count"|"min"|"max"), format ("currency")
- Text: content, heading

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
Two-column with KPIs at top: {"operations":[{"op":"update","path":"layout/columns","value":2},{"op":"add_component","component":{"id":"kpi1","type":"kpi","props":{"dataSource":"/api/data","calculation":"count","label":"Total Items"},"style":{"width":"100%"}}},{"op":"add_component","component":{"id":"kpi2","type":"kpi","props":{"dataSource":"/api/data","calculation":"avg","field":"price","label":"Avg Price"},"style":{"width":"100%"}}},{"op":"reorder_component","id":"kpi1","newIndex":0},{"op":"reorder_component","id":"kpi2","newIndex":1}]}
Dark mode: {"operations":[{"op":"set_style","path":"theme/mode","value":"dark"},{"op":"set_style","path":"theme/backgroundColor","value":"#141414"}]}
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
    
    // Detect multiple intents in prompt
    const hasMultipleIntents = /\b(then|and|also|plus|,)\b/i.test(prompt)
    const intents = hasMultipleIntents 
      ? prompt.split(/\b(then|and|also|plus|,)\b/i).map(s => s.trim()).filter(s => s.length > 0)
      : [prompt]
    
    // Build user prompt with context-aware enhancements
    let userPrompt = `Current schema: ${schemaJson}

User request: ${prompt}`

    // Add multi-intent handling
    if (hasMultipleIntents && intents.length > 1) {
      userPrompt += `\n\nNOTE: This request contains ${intents.length} operations. Process ALL of them:\n${intents.map((intent, i) => `${i+1}. ${intent}`).join('\n')}`
    }

    // Add chain-of-thought for vague requests
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
    
    // Add specific guidance for common patterns
    if (/\b(pie chart|chart).*by category|by category.*(pie|chart)\b/i.test(prompt)) {
      userPrompt += `\n\nNOTE: "pie chart by category" means ADD a new pie chart component. Do not reference existing pie chart components.`
    }
    
    if (/\b(kpi|kpis).*(at top|at the top|on top)\b/i.test(prompt)) {
      userPrompt += `\n\nNOTE: "KPIs at top" means after adding KPIs, use reorder_component operations to move them to the beginning (newIndex: 0, 1, etc.).`
    }
    
    if (/\b(total items|avg price|average price|count|sum)\b/i.test(prompt) && /\bkpi/i.test(prompt)) {
      userPrompt += `\n\nNOTE: When adding KPIs, ALWAYS include dataSource="/api/data". Without dataSource, KPIs will be empty.`
    }
    
    if (/\b(top \d+|show only top \d+|only top \d+)\b/i.test(prompt)) {
      userPrompt += `\n\nNOTE: "top N" means filter the table to show only N rows. Set filters/limit to N, filters/sortBy to "price", and filters/sortOrder to "desc" (highest price first). Do NOT add horizontal scrolling or change table layout.`
    }

    userPrompt += `\n\nCRITICAL: Return ONLY valid JSON. Start with { and end with }. No markdown, no code blocks, no explanations.
Return format: { "operations": [...] }`

    if (!groq) {
      throw new Error('No AI provider configured. Please set GROQ_API_KEY in your environment variables')
    }
    
    const completion = await Promise.race([
      groq.chat.completions.create({
        model: 'llama-3.1-8b-instant', // Fast and efficient Groq model
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent JSON output
        response_format: { type: 'json_object' },
        ...(vague ? { max_tokens: 2000 } : {}), // Limit tokens for vague requests to encourage concise output
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
    console.log('Raw operations from AI:', JSON.stringify(operations, null, 2))
    console.log('Number of raw operations:', operations.length)
    
    const validOps = ['set_style', 'update', 'add_component', 'remove_component', 'move_component', 'replace_component', 'reorder_component']
    let validatedOperations: Operation[] = []

    for (const op of operations) {
      if (!op || typeof op !== 'object') {
        console.warn('Skipping invalid operation:', op)
        continue
      }

      if (!op.op || !validOps.includes(op.op)) {
        console.warn('Skipping operation with invalid op type:', op.op)
        continue
      }

      // Validate operation structure based on type
      try {
        switch (op.op) {
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
            if (!op.component || !op.component.id || !op.component.type) {
              console.warn('Invalid add_component operation: missing component, id, or type', op)
              continue
            }
            // Ensure component has required props structure
            const componentType = String(op.component.type)
            const allowedTypes = ['table', 'chart', 'kpi', 'text', 'pie_chart', 'bar_chart', 'line_chart', 'area_chart', 'scatter_chart', 'radar_chart', 'histogram', 'composed_chart'] as const
            if (!allowedTypes.includes(componentType as any)) {
              console.warn('Invalid component type:', componentType, 'Allowed types:', allowedTypes)
              continue
            }
            const component: Component = {
              id: String(op.component.id),
              type: componentType as Component['type'],
              props: op.component.props || {},
              style: op.component.style || {},
            }
            console.log('✅ Validated add_component:', component.id, component.type)
            validatedOperations.push({ op: 'add_component', component })
            break

          case 'remove_component':
            if (!op.id) {
              console.warn('Invalid remove_component operation: missing id', op)
              continue
            }
            validatedOperations.push({ op: 'remove_component', id: String(op.id) })
            break

          case 'replace_component':
            if (!op.id || !op.component || !op.component.id || !op.component.type) {
              console.warn('Invalid replace_component operation: missing id or component', op)
              continue
            }
            validatedOperations.push({ op: 'replace_component', id: String(op.id), component: op.component })
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

    if (validatedOperations.length === 0 && operations.length > 0) {
      throw new Error('No valid operations found in AI response. Please try rephrasing your request.')
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
