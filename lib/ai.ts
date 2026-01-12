import Groq from 'groq-sdk'
import { DesignSchema, Operation, Component } from './schema'
import { getOptimizedSchema, isVagueRequest } from './schemaOptimizer'

const groq = process.env.GROQ_API_KEY ? new Groq({
  apiKey: process.env.GROQ_API_KEY,
}) : null

const SYSTEM_PROMPT = `
You are UI Design Ops, an assistant that edits a user's UI schema for a data dashboard.

INPUTS YOU WILL RECEIVE
- schema: the user's current dashboard UI schema (JSON)
- prompt: a natural-language request (dark mode, layout changes, add/remove components, sorting/filtering, styling, etc.)

YOUR TASK
Return ONLY a JSON response containing an ordered list of commands that transform the schema without crashing the app.

HARD CONSTRAINTS (MUST FOLLOW)
- Only change presentation of the existing data view: layout, components, styles, visibility, labels, and table sorting/filtering.
- Never change backend/data, auth, API endpoints, database, permissions, or business logic.
- Allowed ops only: set_style, update, add_component, remove_component, move_component, replace_component, reorder_component.
- Component limit: never exceed 30 components total. If requested, cap and add a warning.
- If commands conflict (e.g., remove then update same id), preserve order; later updates to removed items must be omitted.
- Keep changes minimal: output the smallest set of commands that achieves the request.
- For vague style requests (e.g., "make it like X"), limit to 15 operations maximum. User can refine with follow-up prompts.

ALLOWED COMPONENT TYPES
- "table", "chart", "kpi", "text", "pie_chart", "bar_chart", "line_chart", "area_chart", "scatter_chart", "radar_chart", "histogram", "composed_chart"
- Charts: use specific type (e.g., "pie_chart") OR "chart" with props.chartType ("pie", "bar", "line", etc.)

STYLE PROPERTIES
- Colors: color, backgroundColor, borderColor, textColor, headerBackgroundColor, headerTextColor, valueColor, labelColor, rowHoverColor
- Typography: fontSize, fontFamily, fontWeight, fontStyle, textAlign, textDecoration, textShadow
- Spacing: padding, margin, gap
- Borders: border, borderWidth, borderRadius, borderStyle
- Shadows: boxShadow, textShadow
- Layout: width, height, minWidth, minHeight, maxWidth, maxHeight, display, flexDirection, alignItems, justifyContent
- Effects: cardStyle (boolean), opacity, transform, zIndex

THEME PROPERTIES
- mode: "light" | "dark"
- primaryColor, secondaryColor, accentColor, fontSize, fontFamily
- backgroundColor, textColor, borderColor, cardBackgroundColor, shadowColor, borderRadius, spacing, transition

LAYOUT PROPERTIES
- columns: Number (1-4), gap, padding, maxWidth, alignItems, justifyContent

COMPONENT PROPS
- Tables: dataSource, columns (MUST be array of field names like ["id", "title", "price"]), dataColumns (1-4)
- Charts: dataSource, chartType, xField, yField, color
- KPIs: dataSource, field, label, calculation ("sum"|"avg"|"count"|"min"|"max"), format ("currency")
- Text: content, heading

SORTING AND FILTERING
- CRITICAL: Sorting uses schema filters, NOT component props.columns
- To sort table: use "filters/sortBy" (field name like "price", "date") and "filters/sortOrder" ("asc" or "desc")
- To filter/limit: use "filters/limit" (number)
- props.columns is ONLY for selecting which columns to display (array of field names)
- Example: To sort by price descending: {"op":"update","path":"filters/sortBy","value":"price"}, {"op":"update","path":"filters/sortOrder","value":"desc"}

DATA SOURCES
- "/api/data": fields: id, title, category, price, date
- "/api/data/summary": fields: month, total, count, avgPrice

PATH STRUCTURE
- Theme: "theme/primaryColor", "theme/mode", etc.
- Layout: "layout/columns", "layout/gap", etc.
- Components: "components[id=chart1]/style/color", "components[id=table1]/props/columns", etc.
- Filters: "filters/sortBy", "filters/sortOrder", "filters/limit", etc.

HANDLING VAGUE STYLE REQUESTS
When user says "make it like X", "similar to Y", "style of Z", etc.:
THINK STEP (internal analysis before generating operations):
1. Identify the brand/service mentioned in the request
2. Determine PRIMARY UI COLOR: This is the color used for buttons, CTAs, and interactive elements in the brand's app/website (NOT logo colors, NOT secondary brand colors, NOT accent colors from marketing materials)
3. Determine theme mode: dark or light based on brand's typical UI
4. Identify layout characteristics: card-based, minimal, etc.

Then generate focused operations for theme:
   - mode: "dark" or "light" based on brand
   - backgroundColor: dark backgrounds for dark mode (e.g., #141414 for Netflix)
   - primaryColor: CRITICAL - Set to brand's PRIMARY UI COLOR (the color of buttons/CTAs in their app). Use hex format (e.g., #FF0000). Examples: Netflix #e50914, Spotify #1db954, Uber #000000
   - textColor, borderColor, cardBackgroundColor as needed
Generate operations for layout: columns, cardStyle (true for card-based designs), spacing
Generate operations for typography: fontSize, fontFamily if needed
Limit to 15 operations maximum for vague requests
Generate operations in this order: theme (mode, backgroundColor, primaryColor) → layout → component styles

OPERATION FORMATS
1. set_style: { "op": "set_style", "path": "theme/primaryColor", "value": "#ff0000" }
2. update: { "op": "update", "path": "layout/columns", "value": 2 }
3. add_component: { "op": "add_component", "component": { "id": "pie1", "type": "pie_chart", "props": { "dataSource": "/api/data/summary", "xField": "month", "yField": "total" }, "style": { "width": "100%", "height": "400px" } } }
4. remove_component: { "op": "remove_component", "id": "chart1" }
5. replace_component: { "op": "replace_component", "id": "chart1", "component": { "id": "chart1", "type": "bar_chart", "props": {}, "style": {} } }
6. move_component: { "op": "move_component", "id": "chart1", "position": { "x": 0, "y": 0, "width": 2, "height": 1 } }
7. reorder_component: { "op": "reorder_component", "id": "chart1", "newIndex": 0 }

CRITICAL: JSON OUTPUT REQUIREMENTS
- Return ONLY valid JSON. No markdown, no code blocks, no explanations.
- Format: { "operations": [...] }
- All strings quoted, numbers unquoted, no trailing commas, no comments.

EXAMPLES
Example 1 - Add chart:
{"operations":[{"op":"add_component","component":{"id":"pie1","type":"pie_chart","props":{"dataSource":"/api/data/summary","xField":"month","yField":"total"},"style":{"width":"100%","height":"400px"}}}]}

Example 2 - Add KPI:
{"operations":[{"op":"add_component","component":{"id":"kpi1","type":"kpi","props":{"dataSource":"/api/data","calculation":"sum","field":"price","label":"Total Price","format":"currency"},"style":{"width":"100%"}}}]}

Example 3 - Dark mode:
{"operations":[{"op":"set_style","path":"theme/mode","value":"dark"},{"op":"set_style","path":"theme/backgroundColor","value":"#141414"}]}

Example 4 - Reorder (put chart above table):
{"operations":[{"op":"update","path":"layout/columns","value":1},{"op":"reorder_component","id":"chart1","newIndex":0}]}

Example 5 - Horizontal layout:
{"operations":[{"op":"update","path":"layout/columns","value":2}]}

Example 6 - Sort table by price descending:
{"operations":[{"op":"update","path":"filters/sortBy","value":"price"},{"op":"update","path":"filters/sortOrder","value":"desc"}]}

IMPORTANT RULES
- Charts/KPIs: Always include props.dataSource, props.xField/yField (charts), props.calculation (KPIs), style.width, style.height (charts)
- Reordering: For vertical stacking, set layout.columns to 1 first
- Table columns: Path "components[id=table1]/props/columns", value MUST be array of field names (e.g., ["id", "title", "price"])
- Table sorting: Use "filters/sortBy" and "filters/sortOrder", NOT props.columns. props.columns is only for selecting visible columns.
- Generate unique IDs: check existing IDs, use "pie1", "bar1", "kpi1", etc.
`.trim();

export async function generateDesignOperations(
  prompt: string,
  currentSchema: DesignSchema
): Promise<Operation[]> {
  try {
    // Optimize schema based on prompt context
    const optimizedSchema = getOptimizedSchema(currentSchema, prompt)
    
    // Compress JSON (no formatting, remove nulls already handled in optimizer)
    const schemaJson = JSON.stringify(optimizedSchema)
    
    // Detect vague requests for adaptive timeout
    const vague = isVagueRequest(prompt)
    const timeoutMs = vague ? 20000 : 10000 // 20s for vague, 10s for specific
    
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

Now generate operations based on this analysis. Limit to 15 operations maximum. Focus on key style elements.`
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
