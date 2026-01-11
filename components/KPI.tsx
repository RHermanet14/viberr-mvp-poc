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
              calculatedValue = items.reduce((sum: number, item: any) => 
                sum + (parseFloat(item[component.props.field || 'price']) || 0), 0
              ) / items.length
              break
            default:
              calculatedValue = items.length
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
  const formatValue = (val: number) => {
    if (component.props.format === 'currency') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
    }
    return val.toLocaleString()
  }

  return (
    <div className="p-6 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{label}</div>
      <div className="text-3xl font-bold">{formatValue(value)}</div>
    </div>
  )
}
