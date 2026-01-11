'use client'

import { useEffect, useState } from 'react'
import { Component, DesignSchema } from '@/lib/schema'

interface DataTableProps {
  component: Component
  filters?: DesignSchema['filters']
}

export function DataTable({ component, filters }: DataTableProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(component.props.dataSource || '/api/data')
        if (res.ok) {
          let items = await res.json()
          
          // Apply sorting - prefer schema filters, then component props
          const sortBy = filters?.sortBy || component.props.sortBy
          const sortOrder = filters?.sortOrder || component.props.sortOrder || 'desc'
          
          if (sortBy) {
            items.sort((a: any, b: any) => {
              const aVal = a[sortBy]
              const bVal = b[sortBy]
              const order = sortOrder === 'asc' ? 1 : -1
              return aVal > bVal ? order : aVal < bVal ? -order : 0
            })
          }
          
          // Apply limit - prefer schema filters, then component props
          const limit = filters?.limit || component.props.limit
          if (limit) {
            items = items.slice(0, limit)
          }
          
          setData(items)
        }
      } catch (error) {
        console.error('Failed to fetch table data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [component, filters])

  if (loading) {
    return <div className="p-4">Loading table...</div>
  }

  const columns = component.props.columns || Object.keys(data[0] || {})

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            {columns.map((col: string) => (
              <th key={col} className="px-4 py-2 text-left font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800">
              {columns.map((col: string) => (
                <td key={col} className="px-4 py-2">
                  {row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
