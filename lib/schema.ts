export interface Component {
  id: string
  type: 'table' | 'chart' | 'kpi' | 'text'
  props: Record<string, any>
  style?: Record<string, any>
  position?: { x: number; y: number; width: number; height: number }
}

export interface DesignSchema {
  theme: {
    mode: 'light' | 'dark'
    primaryColor: string
    fontSize: string
    fontFamily: string
  }
  layout: {
    columns: number
    gap: number
  }
  components: Component[]
  filters?: {
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    limit?: number
  }
}

export function getDefaultSchema(): DesignSchema {
  return {
    theme: {
      mode: 'light',
      primaryColor: '#3b82f6',
      fontSize: '16px',
      fontFamily: 'system-ui, sans-serif',
    },
    layout: {
      columns: 1,
      gap: 16,
    },
    components: [
      {
        id: 'table1',
        type: 'table',
        props: {
          dataSource: '/api/data',
          columns: ['id', 'title', 'category', 'price', 'date'],
        },
        style: {
          width: '100%',
        },
      },
      {
        id: 'chart1',
        type: 'chart',
        props: {
          chartType: 'line',
          dataSource: '/api/data/summary',
          xField: 'month',
          yField: 'total',
        },
        style: {
          width: '100%',
          height: '400px',
        },
      },
    ],
    filters: {
      sortBy: 'date',
      sortOrder: 'desc',
    },
  }
}

export type Operation = 
  | { op: 'set_style'; path: string; value: any }
  | { op: 'update'; path: string; value: any }
  | { op: 'add_component'; component: Component }
  | { op: 'remove_component'; id: string }
  | { op: 'move_component'; id: string; position: { x: number; y: number } }
  | { op: 'replace_component'; id: string; component: Component }

export function applyOperations(schema: DesignSchema, operations: Operation[]): DesignSchema {
  let result = JSON.parse(JSON.stringify(schema)) as DesignSchema

  for (const operation of operations) {
    try {
      switch (operation.op) {
        case 'set_style':
          setNestedValue(result, operation.path, operation.value)
          break
        case 'update':
          setNestedValue(result, operation.path, operation.value)
          break
        case 'add_component':
          if (result.components.length >= 30) {
            console.warn('Maximum 30 components allowed')
            continue
          }
          result.components.push(operation.component)
          break
        case 'remove_component':
          result.components = result.components.filter(c => c.id !== operation.id)
          break
        case 'move_component':
          const moveComp = result.components.find(c => c.id === operation.id)
          if (moveComp) {
            moveComp.position = operation.position
          }
          break
        case 'replace_component':
          const index = result.components.findIndex(c => c.id === operation.id)
          if (index !== -1) {
            result.components[index] = operation.component
          }
          break
      }
    } catch (error) {
      console.warn(`Failed to apply operation ${operation.op}:`, error)
    }
  }

  return result
}

function setNestedValue(obj: any, path: string, value: any) {
  const parts = path.split('/').filter(p => p)
  let current = obj
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    // Handle component selector: components[id=table1]
    if (part.startsWith('components[') && part.includes('id=')) {
      const match = part.match(/components\[id=([^\]]+)\]/)
      if (match) {
        const componentId = match[1]
        const components = current.components || []
        const component = components.find((c: Component) => c.id === componentId)
        if (component) {
          current = component
        } else {
          throw new Error(`Component ${componentId} not found`)
        }
      }
    } else {
      if (!current[part]) {
        current[part] = {}
      }
      current = current[part]
    }
  }
  
  const lastPart = parts[parts.length - 1]
  current[lastPart] = value
}
