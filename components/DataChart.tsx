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
import { Component, ChartTheme } from '@/lib/schema'

interface DataChartProps {
  component: Component
}

// Map component type to chart type
function getChartType(component: Component): string {
  if (component.type === 'pie_chart') return 'pie'
  if (component.type === 'bar_chart') return 'bar'
  if (component.type === 'line_chart') return 'line'
  if (component.type === 'area_chart') return 'area'
  if (component.type === 'scatter_chart') return 'scatter'
  if (component.type === 'radar_chart') return 'radar'
  if (component.type === 'histogram') return 'bar'
  if (component.type === 'composed_chart') return 'composed'
  return component.props.chartType || 'line'
}

export function DataChart({ component }: DataChartProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
        const res = await fetch(component.props.dataSource || '/api/data/summary')
        if (res.ok) {
          let items = await res.json()
          
          const chartType = getChartType(component)
          const xFieldForAggregation = component.props.xField
          const yField = component.props.yField || 'total'
          const aggregateFunction = component.props.aggregateFunction || 'count'
          
          const dataSource = component.props.dataSource || '/api/data/summary'
          const isRawDataSource = dataSource === '/api/data'
          
          
          const needsAggregation = isRawDataSource && 
            (chartType === 'pie' || chartType === 'bar') && 
            xFieldForAggregation && 
            xFieldForAggregation !== 'month' && 
            items.length > 0 && 
            items[0][xFieldForAggregation] !== undefined && 
            !items[0].month
          
          
          if (needsAggregation && xFieldForAggregation) {
            const aggregateField = yField && items[0][yField] !== undefined ? yField : undefined
            items = aggregateData(items, xFieldForAggregation, aggregateField, aggregateFunction as 'count' | 'sum' | 'avg')
          }
          
          setData(items)
        }
      } catch {
        // Silently handle fetch errors
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [component])

  const chartType = getChartType(component)
  const xField = component.props.xField || ((chartType === 'line' || chartType === 'area' || (chartType === 'bar' && !component.props.xField)) ? 'month' : undefined)
  const yField = component.props.yField || 'total'
  
  const chartColor = component.style?.color || component.props.color || '#3b82f6'
  let chartHeight: number | string = component.style?.height || component.props.height || 400
  if (typeof chartHeight === 'string' && chartHeight.endsWith('px')) {
    chartHeight = parseInt(chartHeight, 10) || 400
  } else if (typeof chartHeight === 'string') {
    chartHeight = parseInt(chartHeight, 10) || 400
  }
  const cardStyle = component.style?.cardStyle === true

  // Extract chartTheme for styling Recharts internals
  const chartTheme: ChartTheme = component.props.chartTheme || {}
  const gridColor = chartTheme.gridColor || '#e5e7eb'
  const gridOpacity = chartTheme.gridOpacity ?? 1
  const axisColor = chartTheme.axisColor || '#666'
  const tickColor = chartTheme.tickColor || '#666'
  const tickFontSize = chartTheme.tickFontSize || 12
  const tickFontFamily = chartTheme.tickFontFamily
  const tooltipBg = chartTheme.tooltipBg || '#fff'
  const tooltipTextColor = chartTheme.tooltipTextColor || '#333'
  const tooltipBorderColor = chartTheme.tooltipBorderColor || '#ccc'
  const tooltipBorderRadius = chartTheme.tooltipBorderRadius || 4
  const legendTextColor = chartTheme.legendTextColor || '#666'
  const legendFontSize = chartTheme.legendFontSize || 12
  const cursorColor = chartTheme.cursorColor || '#ccc'
  const seriesColors = chartTheme.seriesColors || [chartColor]
  
  // Common tick style for axes
  const tickStyle = {
    fill: tickColor,
    fontSize: tickFontSize,
    ...(tickFontFamily && { fontFamily: tickFontFamily }),
  }
  
  // Tooltip content style
  const tooltipContentStyle = {
    backgroundColor: tooltipBg,
    color: tooltipTextColor,
    border: `1px solid ${tooltipBorderColor}`,
    borderRadius: typeof tooltipBorderRadius === 'number' ? `${tooltipBorderRadius}px` : tooltipBorderRadius,
  }
  
  // Legend wrapper style
  const legendWrapperStyle = {
    color: legendTextColor,
    fontSize: typeof legendFontSize === 'number' ? `${legendFontSize}px` : legendFontSize,
  }

  if (loading) {
    return <div className="p-4">Loading chart...</div>
  }

  const commonProps = {
    data,
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
  }

  // Determine if backgroundColor was explicitly set
  const hasExplicitBgColor = component.style?.backgroundColor !== undefined
  const hasExplicitBgImage = component.style?.backgroundImage !== undefined

  // Spread full component.style for CSS-anywhere support
  const chartWrapperStyle = {
    padding: cardStyle ? '1rem' : '0',
    borderRadius: cardStyle ? '0.75rem' : '0',
    boxShadow: cardStyle ? (component.style?.boxShadow || '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)') : component.style?.boxShadow,
    transition: cardStyle ? 'box-shadow 0.3s ease' : undefined,
    minHeight: typeof chartHeight === 'number' ? `${chartHeight}px` : chartHeight,
    width: component.style?.width || '100%',
    // Spread all style properties for full CSS support
    ...component.style,
    // Ensure these take precedence after spread
    backgroundColor: component.style?.backgroundColor,
    // If backgroundColor is set but backgroundImage is not, clear gradient
    backgroundImage: hasExplicitBgColor && !hasExplicitBgImage ? 'none' : component.style?.backgroundImage,
  }

  const chartContent = (() => {
    switch (chartType) {
      case 'bar':
      case 'histogram':
        // Determine the correct value field for bar charts (similar to pie chart logic)
        let barValueField = yField
        if (data[0]) {
          const numericFields = Object.keys(data[0]).filter(key => 
            key !== xField && typeof data[0][key] === 'number'
          )
          if (numericFields.length > 0) {
            // Prefer 'count' if aggregation was used, then yField, then first numeric
            barValueField = numericFields.find(f => f === 'count') 
              || numericFields.find(f => f === yField)
              || numericFields[0]
          }
        }
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={gridOpacity} />
              <XAxis dataKey={xField} stroke={axisColor} tick={tickStyle} />
              <YAxis stroke={axisColor} tick={tickStyle} />
              <Tooltip contentStyle={tooltipContentStyle} cursor={{ fill: cursorColor, fillOpacity: 0.1 }} />
              <Legend wrapperStyle={legendWrapperStyle} />
              <Bar dataKey={barValueField} fill={seriesColors[0] || chartColor} />
            </BarChart>
          </ResponsiveContainer>
        )
      case 'pie':
        if (!data || data.length === 0) {
          return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              No data available for pie chart
            </div>
          )
        }
        let pieValueField = yField
        if (data[0]) {
          const numericFields = Object.keys(data[0]).filter(key => 
            key !== xField && typeof data[0][key] === 'number'
          )
          if (numericFields.length > 0) {
            pieValueField = numericFields.find(f => f === 'count') 
              || numericFields.find(f => f === yField)
              || numericFields[0]
          } else if (data[0][yField] !== undefined) {
            pieValueField = yField
          } else {
            const keys = Object.keys(data[0])
            pieValueField = keys.length > 1 ? keys[1] : yField
          }
        }
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={data.map((item, idx) => ({
                  ...item,
                  fill: seriesColors[idx % seriesColors.length] || chartColor,
                }))}
                dataKey={pieValueField}
                nameKey={xField}
                cx="50%"
                cy="50%"
                outerRadius={Math.min(100, (typeof chartHeight === 'number' ? chartHeight : 400) / 4)}
                fill={chartColor}
                label
              />
              <Tooltip contentStyle={tooltipContentStyle} />
              <Legend wrapperStyle={legendWrapperStyle} />
            </PieChart>
          </ResponsiveContainer>
        )
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={gridOpacity} />
              <XAxis dataKey={xField} stroke={axisColor} tick={tickStyle} />
              <YAxis stroke={axisColor} tick={tickStyle} />
              <Tooltip contentStyle={tooltipContentStyle} cursor={{ stroke: cursorColor }} />
              <Legend wrapperStyle={legendWrapperStyle} />
              <Area type="monotone" dataKey={yField} stroke={seriesColors[0] || chartColor} fill={seriesColors[0] || chartColor} fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        )
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={gridOpacity} />
              <XAxis dataKey={xField} stroke={axisColor} tick={tickStyle} />
              <YAxis dataKey={yField} stroke={axisColor} tick={tickStyle} />
              <Tooltip contentStyle={tooltipContentStyle} cursor={{ strokeDasharray: '3 3', stroke: cursorColor }} />
              <Legend wrapperStyle={legendWrapperStyle} />
              <Scatter dataKey={yField} fill={seriesColors[0] || chartColor} />
            </ScatterChart>
          </ResponsiveContainer>
        )
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RadarChart data={data}>
              <PolarGrid stroke={gridColor} />
              <PolarAngleAxis dataKey={xField} tick={tickStyle} />
              <PolarRadiusAxis tick={tickStyle} />
              <Radar name={yField} dataKey={yField} stroke={seriesColors[0] || chartColor} fill={seriesColors[0] || chartColor} fillOpacity={0.6} />
              <Legend wrapperStyle={legendWrapperStyle} />
              <Tooltip contentStyle={tooltipContentStyle} />
            </RadarChart>
          </ResponsiveContainer>
        )
      case 'composed':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <ComposedChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={gridOpacity} />
              <XAxis dataKey={xField} stroke={axisColor} tick={tickStyle} />
              <YAxis stroke={axisColor} tick={tickStyle} />
              <Tooltip contentStyle={tooltipContentStyle} cursor={{ stroke: cursorColor }} />
              <Legend wrapperStyle={legendWrapperStyle} />
              <Bar dataKey={yField} fill={seriesColors[0] || chartColor} fillOpacity={0.6} />
              <Line type="monotone" dataKey={yField} stroke={seriesColors[1] || seriesColors[0] || chartColor} />
            </ComposedChart>
          </ResponsiveContainer>
        )
      case 'line':
      default:
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={gridOpacity} />
              <XAxis dataKey={xField} stroke={axisColor} tick={tickStyle} />
              <YAxis stroke={axisColor} tick={tickStyle} />
              <Tooltip contentStyle={tooltipContentStyle} cursor={{ stroke: cursorColor }} />
              <Legend wrapperStyle={legendWrapperStyle} />
              <Line type="monotone" dataKey={yField} stroke={seriesColors[0] || chartColor} />
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
