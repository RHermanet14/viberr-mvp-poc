'use client'

import { useEffect, useState } from 'react'
import { 
  LineChart, Line, 
  BarChart, Bar, 
  PieChart, Pie, 
  AreaChart, Area,
  ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { Component } from '@/lib/schema'

interface DataChartProps {
  component: Component
}

// Map component type to chart type
function getChartType(component: Component): string {
  // If component type is a specific chart type, extract it
  if (component.type === 'pie_chart') return 'pie'
  if (component.type === 'bar_chart') return 'bar'
  if (component.type === 'line_chart') return 'line'
  if (component.type === 'area_chart') return 'area'
  if (component.type === 'scatter_chart') return 'scatter'
  if (component.type === 'radar_chart') return 'radar'
  if (component.type === 'histogram') return 'bar' // Histogram uses bar chart
  if (component.type === 'composed_chart') return 'composed'
  // Fall back to props.chartType or default
  return component.props.chartType || 'line'
}

export function DataChart({ component }: DataChartProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // #region agent log
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:35',message:'DataChart component mounted',data:{componentId:component.id,componentType:component.type,props:component.props},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
  }, [component.id]);
  // #endregion

  // Helper function to aggregate data by a field
  function aggregateData(items: any[], groupBy: string, aggregateField?: string, aggregateFn: 'count' | 'sum' | 'avg' = 'count'): any[] {
    const grouped = new Map<string, { count: number; sum: number; items: any[] }>()
    
    for (const item of items) {
      const groupKey = String(item[groupBy] || 'Unknown')
      
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, { count: 0, sum: 0, items: [] })
      }
      
      const group = grouped.get(groupKey)!
      group.count++
      if (aggregateField) {
        const value = parseFloat(item[aggregateField]) || 0
        group.sum += value
        group.items.push(value)
      }
    }
    
    // Determine the value field name for the aggregated data
    // Use 'value' as a consistent name, or the aggregateField if it's a simple field name
    const valueFieldName = aggregateFn === 'count' ? 'count' : (aggregateField || 'value')
    
    return Array.from(grouped.entries()).map(([key, group]) => {
      let value: number
      if (aggregateFn === 'count') {
        value = group.count
      } else if (aggregateFn === 'sum') {
        value = group.sum
      } else if (aggregateFn === 'avg') {
        value = group.count > 0 ? group.sum / group.count : 0
      } else {
        value = group.count
      }
      
      return {
        [groupBy]: key,
        [valueFieldName]: value,
      }
    })
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        // #region agent log
        if (process.env.NODE_ENV === 'development') {
          fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:42',message:'Fetching chart data',data:{componentId:component.id,dataSource:component.props.dataSource},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        }
        // #endregion
        const res = await fetch(component.props.dataSource || '/api/data/summary')
        if (res.ok) {
          let items = await res.json()
          
          // Check if we need to aggregate data (for pie/bar charts grouping by category or other fields)
          const chartType = getChartType(component)
          // For aggregation check, use actual xField from props (don't default) to detect explicit grouping
          const xFieldForAggregation = component.props.xField
          const yField = component.props.yField || 'total'
          const aggregateFunction = component.props.aggregateFunction || 'count' // 'count', 'sum', 'avg'
          
          // If using raw data source and chart needs grouping (pie/bar with non-time-series xField)
          const dataSource = component.props.dataSource || '/api/data/summary'
          const isRawDataSource = dataSource === '/api/data'
          
          // Only aggregate if:
          // 1. Using raw data source (/api/data)
          // 2. Chart type is pie or bar
          // 3. xField is explicitly set (not default) and is NOT 'month' (not time-series)
          // 4. Data has the xField
          // 5. Data is not already aggregated (doesn't have 'month' field from summary)
          const needsAggregation = isRawDataSource && 
            (chartType === 'pie' || chartType === 'bar') && 
            xFieldForAggregation && // xField must be explicitly set (not undefined)
            xFieldForAggregation !== 'month' && // Not time-series
            items.length > 0 && 
            items[0][xFieldForAggregation] !== undefined && // xField exists in data
            !items[0].month // Not already aggregated (summary data has 'month' field)
          
          if (needsAggregation && xFieldForAggregation) {
            // Aggregate data by xField
            // If yField is specified and exists in data, use it for aggregation; otherwise count
            const aggregateField = yField && items[0][yField] !== undefined ? yField : undefined
            items = aggregateData(items, xFieldForAggregation, aggregateField, aggregateFunction as 'count' | 'sum' | 'avg')
          }
          
          if (needsAggregation) {
            // Aggregate data by xField
            // If yField is specified and exists in data, use it for aggregation; otherwise count
            const aggregateField = yField && items[0][yField] !== undefined ? yField : undefined
            items = aggregateData(items, xField, aggregateField, aggregateFunction as 'count' | 'sum' | 'avg')
          }
          
          // #region agent log
          if (process.env.NODE_ENV === 'development') {
            fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:46',message:'Chart data fetched successfully',data:{componentId:component.id,dataCount:items.length,aggregated:needsAggregation},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          }
          // #endregion
          setData(items)
        } else {
          // #region agent log
          if (process.env.NODE_ENV === 'development') {
            fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:49',message:'Chart data fetch failed',data:{componentId:component.id,status:res.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          }
          // #endregion
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error)
        // #region agent log
        if (process.env.NODE_ENV === 'development') {
          fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:52',message:'Chart data fetch error',data:{componentId:component.id,error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        }
        // #endregion
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [component])

  // #region agent log
  // Log chart rendering - MUST be before any conditional returns (Rules of Hooks)
  const chartType = getChartType(component)
  // Default xField based on chart type: time-series charts default to 'month', others need explicit xField
  const xField = component.props.xField || ((chartType === 'line' || chartType === 'area' || (chartType === 'bar' && !component.props.xField)) ? 'month' : undefined)
  const yField = component.props.yField || 'total'
  
  // Pre-compute values needed for logging before conditional return
  const chartColor = component.style?.color || component.props.color || '#3b82f6'
  // Convert height to number if it's a string like "400px"
  let chartHeight: number | string = component.style?.height || component.props.height || 400
  if (typeof chartHeight === 'string' && chartHeight.endsWith('px')) {
    chartHeight = parseInt(chartHeight, 10) || 400
  } else if (typeof chartHeight === 'string') {
    chartHeight = parseInt(chartHeight, 10) || 400
  }
  const cardStyle = component.style?.cardStyle === true
  
  // #region agent log
  useEffect(() => {
    if (!loading && process.env.NODE_ENV === 'development') {
      fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:90',message:'Chart height computed',data:{componentId:component.id,chartHeight,styleHeight:component.style?.height,propsHeight:component.props.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
  }, [component.id, chartHeight, loading]);
  // #endregion
  
  useEffect(() => {
    if (!loading && process.env.NODE_ENV === 'development') {
      fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:82',message:'DataChart rendering chart',data:{componentId:component.id,chartType,dataCount:data.length,xField,yField},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
  }, [component.id, chartType, data.length, loading, xField, yField]);
  
  // Log JSX return - MUST be before conditional return
  useEffect(() => {
    if (!loading && process.env.NODE_ENV === 'development') {
      fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:95',message:'DataChart returning JSX',data:{componentId:component.id,chartType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
  }, [component.id, chartType, loading]);
  // #endregion

  if (loading) {
    // #region agent log
    if (process.env.NODE_ENV === 'development') {
      fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:88',message:'DataChart showing loading state',data:{componentId:component.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
    // #endregion
    return <div className="p-4">Loading chart...</div>
  }

  // chartColor, chartHeight, and cardStyle are already defined above before the conditional return
  const commonProps = {
    data,
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
  }

  const chartWrapperStyle = {
    padding: cardStyle ? '1rem' : '0',
    borderRadius: cardStyle ? '0.75rem' : '0',
    backgroundColor: component.style?.backgroundColor,
    boxShadow: cardStyle ? (component.style?.boxShadow || '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)') : component.style?.boxShadow,
    transition: cardStyle ? 'box-shadow 0.3s ease' : undefined,
    // Ensure wrapper has minimum height to prevent collapse
    minHeight: typeof chartHeight === 'number' ? `${chartHeight}px` : chartHeight,
    width: component.style?.width || '100%',
  }

  const chartContent = (() => {
    switch (chartType) {
      case 'bar':
      case 'histogram':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xField} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={yField} fill={chartColor} />
            </BarChart>
          </ResponsiveContainer>
        )
      case 'pie':
        // Ensure we have data to render
        if (!data || data.length === 0) {
          return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              No data available for pie chart
            </div>
          )
        }
        // For pie charts, determine the value field
        // If data was aggregated, it will have xField as key and count/value as the numeric field
        // Otherwise, use yField or fallback to first numeric field
        let pieValueField = yField
        if (data[0]) {
          // Find the numeric field (exclude xField)
          const numericFields = Object.keys(data[0]).filter(key => 
            key !== xField && typeof data[0][key] === 'number'
          )
          if (numericFields.length > 0) {
            // Prefer: count (for aggregated count), then yField, then any numeric field
            pieValueField = numericFields.find(f => f === 'count') 
              || numericFields.find(f => f === yField)
              || numericFields[0]
          } else if (data[0][yField] !== undefined) {
            pieValueField = yField
          } else {
            // Fallback: use second key (first is likely xField)
            const keys = Object.keys(data[0])
            pieValueField = keys.length > 1 ? keys[1] : yField
          }
        }
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={data}
                dataKey={pieValueField}
                nameKey={xField}
                cx="50%"
                cy="50%"
                outerRadius={Math.min(100, (typeof chartHeight === 'number' ? chartHeight : 400) / 4)}
                fill={chartColor}
                label
              />
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xField} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey={yField} stroke={chartColor} fill={chartColor} fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        )
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xField} />
              <YAxis dataKey={yField} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter dataKey={yField} fill={chartColor} />
            </ScatterChart>
          </ResponsiveContainer>
        )
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RadarChart data={data}>
              <PolarGrid />
              <PolarAngleAxis dataKey={xField} />
              <PolarRadiusAxis />
              <Radar name={yField} dataKey={yField} stroke={chartColor} fill={chartColor} fillOpacity={0.6} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        )
      case 'composed':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ComposedChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xField} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={yField} fill={chartColor} fillOpacity={0.6} />
              <Line type="monotone" dataKey={yField} stroke={chartColor} />
            </ComposedChart>
          </ResponsiveContainer>
        )
      case 'line':
      default:
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xField} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={yField} stroke={chartColor} />
            </LineChart>
          </ResponsiveContainer>
        )
    }
  })()

  return (
    <div
      style={chartWrapperStyle}
      onMouseEnter={(e) => {
        if (cardStyle && !component.style?.boxShadow) {
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (cardStyle && !component.style?.boxShadow) {
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }
      }}
    >
      {chartContent}
    </div>
  )
}
