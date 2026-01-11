import OpenAI from 'openai'
import { DesignSchema, Operation } from './schema'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const SYSTEM_PROMPT = `You are a UI design assistant that helps users customize their dashboard layouts using natural language.

You receive:
1. The current design schema (JSON)
2. A user's natural language request

You must return a JSON array of operations that modify the schema. Available operations:
- set_style: { op: "set_style", path: string, value: any } - Set a style property
- update: { op: "update", path: string, value: any } - Update any property
- add_component: { op: "add_component", component: { id: string, type: "table"|"chart"|"kpi"|"text", props: object, style?: object } }
- remove_component: { op: "remove_component", id: string }
- move_component: { op: "move_component", id: string, position: { x: number, y: number } }
- replace_component: { op: "replace_component", id: string, component: object }

Path examples:
- "theme/mode" → set theme mode
- "theme/fontSize" → set font size
- "components[id=table1]/style/width" → set width of component with id=table1
- "layout/columns" → set number of columns
- "filters/sortBy" → set sort field
- "filters/limit" → set item limit

Component types:
- table: displays tabular data
- chart: displays charts (line, bar, pie)
- kpi: displays key performance indicators
- text: displays text content

Return a JSON object with an "operations" key containing an array of operations. Format: { "operations": [...] }
No explanations, no markdown.`

export async function generateDesignOperations(
  prompt: string,
  currentSchema: DesignSchema
): Promise<Operation[]> {
  try {
    const userPrompt = `Current schema: ${JSON.stringify(currentSchema, null, 2)}

User request: ${prompt}

Return a JSON object with an "operations" key containing an array of operations to fulfill this request.`

    const completion = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
      ),
    ])

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Parse the response - it might be wrapped in a JSON object
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      // If direct parse fails, try to extract JSON from markdown or text
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Invalid JSON response')
      }
    }

    // Handle if the response is wrapped in an object with an "operations" key
    const operations = Array.isArray(parsed) ? parsed : parsed.operations || []

    // Validate operations
    return operations.filter((op: any) => {
      const validOps = ['set_style', 'update', 'add_component', 'remove_component', 'move_component', 'replace_component']
      return op && op.op && validOps.includes(op.op)
    }) as Operation[]
  } catch (error) {
    console.error('AI generation error:', error)
    throw error
  }
}
