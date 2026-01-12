'use client'

import { useEffect, useState } from 'react'
import { Component, DesignSchema } from '@/lib/schema'

interface DataTableProps {
  component: Component
  filters?: DesignSchema['filters']
  theme?: DesignSchema['theme']
}

export function DataTable({ component, filters, theme }: DataTableProps) {
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

  // Ensure columns is always an array (safety check)
  let columns = component.props.columns
  if (!Array.isArray(columns)) {
    // If columns is not an array, fall back to data keys or empty array
    columns = data.length > 0 ? Object.keys(data[0]) : []
    console.warn('Table columns prop must be an array. Falling back to data keys.')
  }
  
  const dataColumns = component.props.dataColumns || 1 // Number of columns to split data into (1 = single column, 2 = two columns, etc.)

  // Split data into chunks for multi-column layout
  const rowsPerColumn = dataColumns > 1 ? Math.ceil(data.length / dataColumns) : data.length
  const dataChunks: any[][] = []
  if (dataColumns > 1) {
    for (let i = 0; i < dataColumns; i++) {
      dataChunks.push(data.slice(i * rowsPerColumn, (i + 1) * rowsPerColumn))
    }
  } else {
    dataChunks.push(data)
  }

  // Apply custom styles from component.style, with fallbacks
  const tableStyle = {
    border: component.style?.border || `1px solid ${theme?.borderColor || '#e5e7eb'}`,
    borderRadius: component.style?.borderRadius || '0.5rem',
    backgroundColor: component.style?.backgroundColor || theme?.cardBackgroundColor,
    boxShadow: component.style?.boxShadow,
    transition: component.style?.boxShadow ? 'box-shadow 0.3s ease' : undefined,
    ...component.style,
  }
  
  // Theme-aware colors - use component styles first, then theme colors (no mode-based defaults)
  const headerBg = component.style?.headerBackgroundColor || theme?.cardBackgroundColor
  const headerTextColor = component.style?.headerTextColor || theme?.textColor
  const rowHoverColor = component.style?.rowHoverColor || theme?.cardBackgroundColor
  const textColor = component.style?.textColor || theme?.textColor
  const cardStyle = component.style?.cardStyle === true

  // Calculate max height - use component style maxHeight if provided, otherwise use viewport-based default
  const maxHeight = component.style?.maxHeight 
    ? (typeof component.style.maxHeight === 'string' 
        ? component.style.maxHeight 
        : `${component.style.maxHeight}px`)
    : 'calc(100vh - 300px)' // Default: viewport height minus space for header/controls

  return (
    <div 
      style={{
        ...tableStyle,
        maxHeight: maxHeight,
        overflowY: 'auto',
        overflowX: 'auto',
        ...(cardStyle && {
          boxShadow: tableStyle.boxShadow || '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          borderRadius: tableStyle.borderRadius || '0.75rem',
          padding: '1rem',
        }),
      }}
      onMouseEnter={(e) => {
        if (cardStyle && !tableStyle.boxShadow) {
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (cardStyle && !tableStyle.boxShadow) {
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }
      }}
    >
      <div style={{
        display: dataColumns > 1 ? 'grid' : 'block',
        gridTemplateColumns: dataColumns > 1 ? `repeat(${dataColumns}, 1fr)` : undefined,
        gap: dataColumns > 1 ? '1rem' : undefined,
        minWidth: 'fit-content', // Ensure content doesn't get squished
      }}>
        {dataChunks.map((chunk, chunkIdx) => (
          <table 
            key={chunkIdx}
            className="w-full"
            style={{
              ...(textColor ? { color: textColor } : {}),
              tableLayout: 'auto', // Allow table to size naturally
              minWidth: '100%', // Ensure table takes full width of container
            }}
          >
            <thead style={headerBg ? { backgroundColor: headerBg } : undefined}>
              <tr>
                {columns.map((col: string) => (
                  <th 
                    key={col} 
                    className="px-4 py-2 text-left font-semibold"
                  style={{ 
                    ...(headerTextColor && { color: headerTextColor }),
                    ...(component.style?.fontSize ? { fontSize: component.style.fontSize } : {}),
                    ...(headerBg && { backgroundColor: headerBg }),
                  } as React.CSSProperties}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={textColor ? { color: textColor } : undefined}>
              {chunk.map((row, idx) => (
                <tr 
                  key={`${chunkIdx}-${idx}`} 
                  style={{ 
                    ...(rowHoverColor && { '--hover-bg': rowHoverColor }),
                    borderTop: `1px solid ${theme?.borderColor || '#e5e7eb'}`,
                    backgroundColor: 'transparent',
                    ...(textColor && { color: textColor }),
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    if (rowHoverColor) {
                      e.currentTarget.style.backgroundColor = rowHoverColor
                      // Ensure text remains readable on hover
                      if (textColor) {
                        Array.from(e.currentTarget.children).forEach((cell: any) => {
                          if (cell.style) {
                            cell.style.color = textColor
                          }
                        })
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = ''
                    // Reset text color if needed
                    if (textColor) {
                      Array.from(e.currentTarget.children).forEach((cell: any) => {
                        if (cell.style) {
                          cell.style.color = textColor
                        }
                      })
                    }
                  }}
                >
                  {columns.map((col: string) => (
                    <td 
                      key={col} 
                      className="px-4 py-2"
                      style={{
                        ...(textColor && { color: textColor }),
                        ...(component.style?.fontSize && { fontSize: component.style?.fontSize }),
                        backgroundColor: 'transparent',
                      }}
                    >
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}
