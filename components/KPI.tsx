'use client'

import { useEffect, useState } from 'react'
import { Component, DesignSchema } from '@/lib/schema'

interface KPIProps {
  component: Component
  theme?: DesignSchema['theme']
}

export function KPI({ component, theme }: KPIProps) {
  const [value, setValue] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(component.props.dataSource || '/api/data')
        if (res.ok) {
          const items = await res.json()
          
          // Calculate KPI based on metric (support both 'metric' and 'calculation' prop names for backward compatibility)
          const metric = component.props.metric || component.props.calculation || 'count'
          let calculatedValue: number
          
          switch (metric) {
            case 'count':
              calculatedValue = items.length
              break
            case 'sum':
              calculatedValue = items.reduce((sum: number, item: any) => 
                sum + (parseFloat(item[component.props.field || 'price']) || 0), 0
              )
              break
            case 'avg':
              if (items.length === 0) {
                calculatedValue = 0
              } else {
                calculatedValue = items.reduce((sum: number, item: any) => 
                  sum + (parseFloat(item[component.props.field || 'price']) || 0), 0
                ) / items.length
              }
              break
            case 'min':
              if (items.length === 0) {
                calculatedValue = 0
              } else {
                calculatedValue = Math.min(...items.map((item: any) => 
                  parseFloat(item[component.props.field || 'price']) || 0
                ))
              }
              break
            case 'max':
              if (items.length === 0) {
                calculatedValue = 0
              } else {
                calculatedValue = Math.max(...items.map((item: any) => 
                  parseFloat(item[component.props.field || 'price']) || 0
                ))
              }
              break
            default:
              calculatedValue = items.length
          }
          
          // Ensure calculatedValue is a valid number
          if (isNaN(calculatedValue) || !isFinite(calculatedValue)) {
            calculatedValue = 0
          }
          
          setValue(calculatedValue)
        }
      } catch (error) {
        console.error('Failed to fetch KPI data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [component])

  if (loading) {
    return <div className="p-4">Loading KPI...</div>
  }

  const label = component.props.label || 'KPI'
  const formatValue = (val: number | null) => {
    if (val === null || val === undefined || isNaN(val)) {
      return 'N/A'
    }
    if (component.props.format === 'currency') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
    }
    return val.toLocaleString()
  }

  // Determine theme-aware colors
  const isDarkMode = theme?.mode === 'dark'
  const defaultBgColor = isDarkMode ? '#1f2937' : '#f9fafb'
  const defaultBorderColor = isDarkMode ? '#374151' : '#e5e7eb'
  const defaultTextColor = theme?.textColor || (isDarkMode ? '#f9fafb' : '#111827')
  const defaultLabelColor = component.style?.labelColor || theme?.textColor || (isDarkMode ? '#d1d5db' : '#6b7280')
  const defaultValueColor = component.style?.valueColor || theme?.textColor || (isDarkMode ? '#ffffff' : '#111827')

  // Apply custom styles from component.style, with theme-aware fallbacks
  const kpiStyle = {
    padding: component.style?.padding || '1.5rem',
    border: component.style?.border || `1px solid ${defaultBorderColor}`,
    borderColor: component.style?.borderColor || theme?.borderColor || defaultBorderColor,
    borderRadius: component.style?.borderRadius || '0.5rem',
    backgroundColor: component.style?.backgroundColor || theme?.cardBackgroundColor || defaultBgColor,
    backgroundImage: component.style?.backgroundImage,
    backgroundSize: component.style?.backgroundSize || 'cover',
    backgroundPosition: component.style?.backgroundPosition || 'center',
    backgroundRepeat: component.style?.backgroundRepeat || 'no-repeat',
    boxShadow: component.style?.boxShadow,
    transition: component.style?.boxShadow ? 'box-shadow 0.3s ease' : undefined,
    // Prevent text overflow
    width: component.style?.width || '100%',
    minWidth: component.style?.minWidth || 0,
    maxWidth: component.style?.maxWidth || '100%',
    overflow: 'hidden',
    ...component.style,
  }
  const cardStyle = component.style?.cardStyle === true

  return (
    <div 
      style={{
        ...kpiStyle,
        ...(cardStyle && {
          boxShadow: kpiStyle.boxShadow || '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          borderRadius: kpiStyle.borderRadius || '0.75rem',
        }),
      }}
      onMouseEnter={(e) => {
        if (cardStyle && !kpiStyle.boxShadow) {
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (cardStyle && !kpiStyle.boxShadow) {
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }
      }}
    >
      <div 
        className="text-sm mb-2"
        style={{
          color: component.style?.labelColor || theme?.textColor || defaultLabelColor,
          fontSize: component.style?.fontSize,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div 
        className="font-bold"
        style={{
          color: component.style?.valueColor || theme?.textColor || defaultValueColor,
          fontSize: component.style?.fontSize || '1.875rem',
          overflow: 'hidden',
          wordBreak: 'break-word',
          // Allow font size to scale down if needed
          lineHeight: 1.2,
          // Ensure text doesn't overflow container
          maxWidth: '100%',
        }}
      >
        {formatValue(value)}
      </div>
    </div>
  )
}
