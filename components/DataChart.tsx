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
    fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:35',message:'DataChart component mounted',data:{componentId:component.id,componentType:component.type,props:component.props},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }, [component.id]);
  // #endregion

  useEffect(() => {
    const fetchData = async () => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:42',message:'Fetching chart data',data:{componentId:component.id,dataSource:component.props.dataSource},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        const res = await fetch(component.props.dataSource || '/api/data/summary')
        if (res.ok) {
          const items = await res.json()
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:46',message:'Chart data fetched successfully',data:{componentId:component.id,dataCount:items.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          setData(items)
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:49',message:'Chart data fetch failed',data:{componentId:component.id,status:res.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:52',message:'Chart data fetch error',data:{componentId:component.id,error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
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
  const xField = component.props.xField || 'month'
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
    if (!loading) {
      fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:90',message:'Chart height computed',data:{componentId:component.id,chartHeight,styleHeight:component.style?.height,propsHeight:component.props.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
  }, [component.id, chartHeight, loading]);
  // #endregion
  
  useEffect(() => {
    if (!loading) {
      fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:82',message:'DataChart rendering chart',data:{componentId:component.id,chartType,dataCount:data.length,xField,yField},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
  }, [component.id, chartType, data.length, loading, xField, yField]);
  
  // Log JSX return - MUST be before conditional return
  useEffect(() => {
    if (!loading) {
      fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:95',message:'DataChart returning JSX',data:{componentId:component.id,chartType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
  }, [component.id, chartType, loading]);
  // #endregion

  if (loading) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/16dc12c7-882f-427a-9657-bb345d43bdac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DataChart.tsx:88',message:'DataChart showing loading state',data:{componentId:component.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
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
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={data}
                dataKey={yField}
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
