'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Component } from '@/lib/schema'

interface DataChartProps {
  component: Component
}

export function DataChart({ component }: DataChartProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(component.props.dataSource || '/api/data/summary')
        if (res.ok) {
          const items = await res.json()
          setData(items)
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [component])

  if (loading) {
    return <div className="p-4">Loading chart...</div>
  }

  const chartType = component.props.chartType || 'line'
  const xField = component.props.xField || 'month'
  const yField = component.props.yField || 'total'

  const commonProps = {
    data,
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
  }

  switch (chartType) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xField} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={yField} fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      )
    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={data}
              dataKey={yField}
              nameKey={xField}
              cx="50%"
              cy="50%"
              outerRadius={100}
              fill="#3b82f6"
              label
            />
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
    case 'line':
    default:
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xField} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={yField} stroke="#3b82f6" />
          </LineChart>
        </ResponsiveContainer>
      )
  }
}
