import Groq from 'groq-sdk'
import { DesignSchema, Operation, Component } from './schema'

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
 
ALLOWED COMPONENT TYPES
The schema supports these component types:
- "table": Data tables with columns, sorting, filtering
- "chart": Generic chart (use chartType prop: "line", "bar", "pie")
- "pie_chart": Pie chart component
- "bar_chart": Bar chart component
- "line_chart": Line chart component
- "area_chart": Area chart component
- "scatter_chart": Scatter plot component
- "radar_chart": Radar/spider chart component
- "histogram": Histogram component
- "composed_chart": Multi-series chart (e.g., line + bar)
- "kpi": Key performance indicator cards
- "text": Text/heading components

When adding charts, use the specific type (e.g., "pie_chart") OR use "chart" with props.chartType set to "pie", "bar", "line", etc.

COMPONENT STYLE PROPERTIES
Each component can have extensive styling via the "style" object:
- Colors: color, backgroundColor, borderColor, textColor, headerBackgroundColor, headerTextColor, valueColor, labelColor, rowHoverColor
- Typography: fontSize, fontFamily, fontWeight, fontStyle, textAlign, textDecoration, textShadow
- Spacing: padding, margin, gap
- Borders: border, borderWidth, borderRadius, borderStyle
- Shadows: boxShadow, textShadow
- Layout: width, height, minWidth, minHeight, maxWidth, maxHeight, display, flexDirection, alignItems, justifyContent
- Effects: cardStyle (boolean), opacity, transform, zIndex

THEME PROPERTIES
The theme object supports:
- mode: "light" | "dark"
- primaryColor: Main accent color (affects charts, buttons)
- secondaryColor: Secondary accent color
- accentColor: Additional accent color
- fontSize: Base font size
- fontFamily: Base font family
- backgroundColor: Page background color
- textColor: Default text color
- borderColor: Default border color
- cardBackgroundColor: Default card background
- shadowColor: Default shadow color
- borderRadius: Default border radius
- spacing: Default spacing unit
- transition: CSS transition string

LAYOUT PROPERTIES
The layout object supports:
- columns: Number of grid columns (1-4)
- gap: Gap between components (pixels)
- padding: Container padding
- maxWidth: Maximum container width
- alignItems: Vertical alignment
- justifyContent: Horizontal alignment

COMPONENT PROPS
- Tables: dataSource, columns (array of field names), dataColumns (number: 1-4, splits table data into multiple columns)
- Charts: dataSource, chartType (if using generic "chart" type), xField, yField, color
- KPIs: dataSource, field (for aggregation), label, calculation ("sum" | "avg" | "count" | "min" | "max")
- Text: content, heading (boolean)

DATA SOURCES
- "/api/data": Individual items with fields: id, title, category, price, date
- "/api/data/summary": Aggregated monthly data with fields: month, total, count, avgPrice

PATH STRUCTURE
- Theme: "theme/primaryColor", "theme/backgroundColor", "theme/mode", etc.
- Layout: "layout/columns", "layout/gap", "layout/padding", etc.
- Components: "components[id=chart1]/style/color", "components[id=table1]/props/columns", etc.
- Filters: "filters/sortBy", "filters/limit", "filters/search", etc.

CRITICAL: JSON OUTPUT REQUIREMENTS
You MUST return valid JSON only. No markdown, no explanations, no code blocks, no text outside JSON.
The response MUST be parseable by JSON.parse() without any preprocessing.

REQUIRED OUTPUT FORMAT (STRICT JSON)
Return EXACTLY this structure - no variations:
{
  "operations": [
    {
      "op": "set_style",
      "path": "theme/primaryColor",
      "value": "#ff0000"
    }
  ]
}

OPERATION FORMATS (EXACT STRUCTURE REQUIRED)
1. set_style: { "op": "set_style", "path": "theme/primaryColor", "value": "#ff0000" }
2. update: { "op": "update", "path": "layout/columns", "value": 2 }
3. add_component: { "op": "add_component", "component": { "id": "pie1", "type": "pie_chart", "props": {}, "style": {} } }
4. remove_component: { "op": "remove_component", "id": "chart1" }
5. replace_component: { "op": "replace_component", "id": "chart1", "component": { "id": "chart1", "type": "bar_chart", "props": {}, "style": {} } }
6. move_component: { "op": "move_component", "id": "chart1", "position": { "x": 0, "y": 0, "width": 2, "height": 1 } }
7. reorder_component: { "op": "reorder_component", "id": "chart1", "newIndex": 0 }

JSON VALIDATION RULES
- "operations" must be an array (can be empty [])
- Each operation must have "op" field
- Only include fields required for each operation type
- All strings must be properly quoted
- All numbers must be unquoted
- No trailing commas
- No comments
- No markdown code fences (use \`\`\`json or \`\`\`)
- No explanatory text before or after JSON

EXAMPLES (COPY THESE EXACT FORMATS)
Example 1 - Add pie chart (REQUIRED when user asks to add any chart):
{
  "operations": [
    {
      "op": "add_component",
      "component": {
        "id": "pie1",
        "type": "pie_chart",
        "props": {
          "dataSource": "/api/data/summary",
          "xField": "month",
          "yField": "total"
        },
        "style": {
          "width": "100%",
          "height": "400px"
        }
      }
    }
  ]
}

Example 1b - Add bar chart:
{
  "operations": [
    {
      "op": "add_component",
      "component": {
        "id": "bar1",
        "type": "bar_chart",
        "props": {
          "dataSource": "/api/data/summary",
          "xField": "month",
          "yField": "total"
        },
        "style": {
          "width": "100%",
          "height": "400px"
        }
      }
    }
  ]
}

IMPORTANT FOR ADDING CHARTS:
- When user says "add a chart", "add pie chart", "add bar chart", etc., you MUST use add_component operation
- Generate a unique ID: check existing component IDs in the schema, use "pie1", "pie2", "bar1", "line1", etc.
- Always include props.dataSource, props.xField, and props.yField
- Always include style.width and style.height (at minimum)
- The component will NOT be added if any required fields are missing

Example 2 - Dark mode:
{
  "operations": [
    {
      "op": "set_style",
      "path": "theme/mode",
      "value": "dark"
    },
    {
      "op": "set_style",
      "path": "theme/backgroundColor",
      "value": "#141414"
    }
  ]
}

Example 3 - Change chart color:
{
  "operations": [
    {
      "op": "set_style",
      "path": "components[id=chart1]/style/color",
      "value": "#ff0000"
    }
  ]
}

IMPORTANT FOR ADDING CHARTS:
- When user says "add a chart", "add pie chart", "add bar chart", etc., you MUST use add_component operation
- Generate a unique ID: check existing component IDs in the schema, use "pie1", "pie2", "bar1", "line1", etc.
- Always include props.dataSource, props.xField, and props.yField
- Always include style.width and style.height (at minimum)
- The component will NOT be added if any required fields are missing

REORDERING COMPONENTS:
- When user says "put X above Y", "move X to top", "reorder components", "put X below Y", etc., use reorder_component operation
- CRITICAL: For vertical stacking (above/below), you MUST also set layout.columns to 1 using update operation
- If layout.columns > 1, components will appear side-by-side horizontally instead of stacking vertically
- newIndex is 0-based: 0 = first position, 1 = second position, etc.
- To move a component to the top, use newIndex: 0
- To move a component above another component, find that component's current index and use newIndex: (that index)
- To move a component below another component, find that component's current index and use newIndex: (that index + 1)
- Example: If chart1 is at index 1 and table1 is at index 0, to put chart1 above table1, use both operations:
  1. Set layout.columns to 1: { "op": "update", "path": "layout/columns", "value": 1 }
  2. Reorder: { "op": "reorder_component", "id": "chart1", "newIndex": 0 }

Example 4 - Reorder component vertically (put chart above table):
{
  "operations": [
    {
      "op": "update",
      "path": "layout/columns",
      "value": 1
    },
    {
      "op": "reorder_component",
      "id": "chart1",
      "newIndex": 0
    }
  ]
}

Example 4b - Reorder component vertically (put chart below table):
{
  "operations": [
    {
      "op": "update",
      "path": "layout/columns",
      "value": 1
    },
    {
      "op": "reorder_component",
      "id": "chart1",
      "newIndex": 1
    }
  ]
}

UPDATING TABLE COLUMNS:
- When user says "show only X and Y columns", "add column Z", "remove column X", etc., use update operation
- Path format: "components[id=table1]/props/columns"
- Value must be an array of field names (strings)
- Available fields from /api/data: id, title, category, price, date
- Available fields from /api/data/summary: month, total, count, avgPrice
- Example: To show only id, title, and price: { "op": "update", "path": "components[id=table1]/props/columns", "value": ["id", "title", "price"] }

Example 5 - Update table columns (show only id, title, price):
{
  "operations": [
    {
      "op": "update",
      "path": "components[id=table1]/props/columns",
      "value": ["id", "title", "price"]
    }
  ]
}

DASHBOARD LAYOUT COLUMNS (HORIZONTAL ALIGNMENT):
- When user says "put components side by side", "horizontal layout", "multiple columns", "2 column layout", "3 column layout", etc., use update operation
- Path format: "layout/columns"
- Value must be a number: 1 = single column (vertical stacking), 2 = two columns side-by-side, 3 = three columns, 4 = four columns
- Setting layout.columns > 1 will make components appear horizontally next to each other
- Example: To display components in 2 columns side-by-side: { "op": "update", "path": "layout/columns", "value": 2 }

Example 5a - Horizontal layout (2 columns side-by-side):
{
  "operations": [
    {
      "op": "update",
      "path": "layout/columns",
      "value": 2
    }
  ]
}

MULTI-COLUMN TABLE LAYOUT:
- When user says "show table data in multiple columns", "split table into 2 columns", "display table in 2 columns", "put table data in multiple columns", etc., use update operation
- Path format: "components[id=table1]/props/dataColumns"
- Value must be a number: 1 = single column (default), 2 = two columns side-by-side, 3 = three columns, 4 = four columns
- The table data will be split evenly across the specified number of columns, each with its own header
- Example: To display table data in 2 columns: { "op": "update", "path": "components[id=table1]/props/dataColumns", "value": 2 }

Example 6 - Multi-column table layout (display data in 2 columns):
{
  "operations": [
    {
      "op": "update",
      "path": "components[id=table1]/props/dataColumns",
      "value": 2
    }
  ]
}

INTERNAL PROCESS (DO NOT OUTPUT)
1) Parse the prompt into UI intents (theme, typography, layout, components, sort/filter, styling).
2) Inspect schema to find existing component ids/types and valid destinations/containers.
3) For reordering: 
   - If user wants vertical stacking (above/below), ALWAYS set layout.columns to 1 first
   - If user wants horizontal layout (side by side, multiple columns), set layout.columns to 2, 3, or 4
   - Find current index of component to move, calculate target index based on user request
   - Use reorder_component to change array order
4) For dashboard layout: if user wants horizontal alignment or multiple columns, update layout.columns (2-4).
5) For table columns: identify which columns user wants to show/hide, update props.columns array.
6) For multi-column table layout: if user wants data in multiple columns, update props.dataColumns (1-4).
7) Produce the smallest safe command list using the allowed component types and style properties.
8) If uncertain, choose a conservative change and add a warning.
`.trim();

export async function generateDesignOperations(
  prompt: string,
  currentSchema: DesignSchema
): Promise<Operation[]> {
  try {
    const userPrompt = `Current schema: ${JSON.stringify(currentSchema, null, 2)}

User request: ${prompt}

CRITICAL: Return ONLY valid JSON. Start with { and end with }. No markdown, no code blocks, no explanations.
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
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 10s')), 30000)
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
    const validatedOperations: Operation[] = []

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

    return validatedOperations
  } catch (error) {
    console.error('AI generation error:', error)
    throw error
  }
}
