import { z } from 'zod'
import { DesignSchema, Operation, Component } from './schema'

// JSON Schema validation using Zod
const ComponentSchema = z.object({
  id: z.string(),
  type: z.enum(['table', 'chart', 'kpi', 'text', 'pie_chart', 'bar_chart', 'line_chart', 'area_chart', 'scatter_chart', 'radar_chart', 'histogram', 'composed_chart']),
  props: z.record(z.any()).optional().default({}),
  style: z.record(z.any()).optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
})

const DesignSchemaSchema = z.object({
  theme: z.object({
    mode: z.enum(['light', 'dark']),
    primaryColor: z.string(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    fontSize: z.string(),
    fontFamily: z.string(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
    borderColor: z.string().optional(),
    cardBackgroundColor: z.string().optional(),
    shadowColor: z.string().optional(),
    borderRadius: z.union([z.string(), z.number()]).optional(),
    spacing: z.number().optional(),
    transition: z.string().optional(),
  }),
  layout: z.object({
    columns: z.number().min(1).max(4),
    gap: z.number(),
    padding: z.union([z.number(), z.string()]).optional(),
    maxWidth: z.union([z.string(), z.number()]).optional(),
    alignItems: z.enum(['flex-start', 'flex-end', 'center', 'stretch']).optional(),
    justifyContent: z.enum(['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly']).optional(),
  }),
  components: z.array(ComponentSchema).max(30),
  filters: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.number().optional(),
    search: z.string().optional(),
    category: z.string().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }).optional(),
})

const OperationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('set_style'),
    path: z.string(),
    value: z.any(),
  }),
  z.object({
    op: z.literal('update'),
    path: z.string(),
    value: z.any(),
  }),
  z.object({
    op: z.literal('add_component'),
    component: ComponentSchema,
  }),
  z.object({
    op: z.literal('remove_component'),
    id: z.string(),
  }),
  z.object({
    op: z.literal('move_component'),
    id: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
  }),
  z.object({
    op: z.literal('replace_component'),
    id: z.string(),
    component: ComponentSchema,
  }),
  z.object({
    op: z.literal('reorder_component'),
    id: z.string(),
    newIndex: z.number(),
  }),
])

export function validateSchema(schema: unknown): { valid: boolean; error?: string } {
  try {
    DesignSchemaSchema.parse(schema)
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: `Schema validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      }
    }
    return {
      valid: false,
      error: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export function validateOperations(operations: unknown[]): { valid: boolean; error?: string } {
  try {
    for (const op of operations) {
      OperationSchema.parse(op)
    }
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: `Operation validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      }
    }
    return {
      valid: false,
      error: `Operation validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// Validate that component IDs referenced in operations exist in the schema
// Note: Components added via add_component in the same batch are considered valid for subsequent operations
export function validateComponentIds(operations: Operation[], schema: DesignSchema): { valid: boolean; error?: string } {
  const componentIds = new Set(schema.components.map(c => c.id))
  
  // First pass: collect all component IDs that will be added in this batch
  const addedComponentIds = new Set<string>()
  for (const op of operations) {
    if (op.op === 'add_component') {
      addedComponentIds.add(op.component.id)
    }
  }
  
  // Combine existing and newly added component IDs
  const allValidComponentIds = new Set<string>()
  // Convert Sets to arrays for ES5 compatibility
  Array.from(componentIds).forEach(id => allValidComponentIds.add(id))
  Array.from(addedComponentIds).forEach(id => allValidComponentIds.add(id))
  
  for (const op of operations) {
    // Check remove_component, move_component, replace_component, reorder_component
    if (op.op === 'remove_component' || op.op === 'move_component' || op.op === 'replace_component' || op.op === 'reorder_component') {
      if (!allValidComponentIds.has(op.id)) {
        return {
          valid: false,
          error: `Operation references unknown component ID: ${op.id}`,
        }
      }
    }
    
    // Check set_style and update paths that reference components
    // Note: set_style operations on non-existent components are allowed (they'll be silently ignored)
    if (op.op === 'set_style' || op.op === 'update') {
      const componentMatch = op.path.match(/components\[id=([^\]]+)\]/)
      if (componentMatch) {
        const componentId = componentMatch[1]
        // Allow set_style/update on non-existent components (they'll be ignored during apply)
        // Only validate for operations that require the component to exist
        // (Currently all set_style/update operations are allowed to reference non-existent components)
      }
    }
  }
  
  return { valid: true }
}
