'use client'

import { useEffect, useState } from 'react'
import { Component } from '@/lib/schema'

interface KPIProps {
  component: Component
}

export function KPI({ component }: KPIProps) {
  const [value, setValue] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(component.props.dataSource || '/api/data')
        if (res.ok) {
          const items = await res.json()
          
          // Calculate KPI based on metric
          const metric = component.props.metric || 'count'
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

  // Apply custom styles from component.style, with fallbacks
  const kpiStyle = {
    padding: component.style?.padding || '1.5rem',
    border: component.style?.border || '1px solid #e5e7eb',
    borderRadius: component.style?.borderRadius || '0.5rem',
    backgroundColor: component.style?.backgroundColor || '#f9fafb',
    boxShadow: component.style?.boxShadow,
    transition: component.style?.boxShadow ? 'box-shadow 0.3s ease' : undefined,
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
          color: component.style?.labelColor || '#6b7280',
          fontSize: component.style?.fontSize,
        }}
      >
        {label}
      </div>
      <div 
        className="text-3xl font-bold"
        style={{
          color: component.style?.valueColor,
          fontSize: component.style?.fontSize || '1.875rem',
        }}
      >
        {formatValue(value)}
      </div>
    </div>
  )
}
