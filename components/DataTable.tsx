'use client'

import { useEffect, useState } from 'react'
import { Component, DesignSchema } from '@/lib/schema'

interface DataTableProps {
  component: Component
  filters?: DesignSchema['filters']
  theme?: DesignSchema['theme']
}

// Helper function to detect if a value is an image URL
function isImageUrl(value: any): boolean {
  if (typeof value !== 'string') return false
  const lower = value.toLowerCase().trim()
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:image/') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.svg')
  )
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
      } catch {
        // Silently handle fetch errors
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
  // Extract border-related properties to avoid mixing shorthand and non-shorthand
  const {
    border: styleBorder,
    borderColor: styleBorderColor,
    borderWidth: styleBorderWidth,
    borderStyle: styleBorderStyle,
    ...otherStyles
  } = component.style || {}
  
  // Build border property: prefer explicit border, otherwise build from parts, otherwise use default
  const borderValue = styleBorder || 
    (styleBorderColor || styleBorderWidth || styleBorderStyle
      ? `${styleBorderWidth || '1px'} ${styleBorderStyle || 'solid'} ${styleBorderColor || theme?.borderColor || '#e5e7eb'}`
      : `1px solid ${theme?.borderColor || '#e5e7eb'}`)
  
  // Determine if backgroundColor was explicitly set
  const hasExplicitBgColor = component.style?.backgroundColor !== undefined
  const hasExplicitBgImage = component.style?.backgroundImage !== undefined

  const tableStyle = {
    border: borderValue,
    borderRadius: component.style?.borderRadius || '0.5rem',
    backgroundColor: component.style?.backgroundColor || theme?.cardBackgroundColor,
    backgroundSize: component.style?.backgroundSize || 'cover',
    backgroundPosition: component.style?.backgroundPosition || 'center',
    backgroundRepeat: component.style?.backgroundRepeat || 'no-repeat',
    boxShadow: component.style?.boxShadow,
    transition: component.style?.boxShadow ? 'box-shadow 0.3s ease' : undefined,
    ...otherStyles,
    // If backgroundColor is set but backgroundImage is not, clear gradient
    backgroundImage: hasExplicitBgColor && !hasExplicitBgImage ? 'none' : component.style?.backgroundImage,
  }
  
  // Theme-aware colors - use component styles first, then theme colors (no mode-based defaults)
  const headerBg = component.style?.headerBackgroundColor || theme?.cardBackgroundColor
  const headerTextColor = component.style?.headerTextColor || theme?.textColor
  const rowHoverColor = component.style?.rowHoverColor || theme?.cardBackgroundColor
  const textColor = component.style?.textColor || theme?.textColor
  const cardStyle = component.style?.cardStyle === true
  
  // New table-specific style properties
  const cellPadding = component.style?.cellPadding
  const rowStripeColor = component.style?.rowStripeColor
  const dividerColor = component.style?.dividerColor || theme?.borderColor || '#e5e7eb'

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
                    className="text-left font-semibold"
                  style={{ 
                    padding: cellPadding || '0.5rem 1rem',
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
                    borderTop: `1px solid ${dividerColor}`,
                    backgroundColor: rowStripeColor && idx % 2 === 1 ? rowStripeColor : 'transparent',
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
                    // Restore stripe color if applicable, otherwise transparent
                    const isStripedRow = rowStripeColor && idx % 2 === 1
                    e.currentTarget.style.backgroundColor = isStripedRow ? rowStripeColor : 'transparent'
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
                  {columns.map((col: string) => {
                    const cellValue = row[col]
                    const isImage = isImageUrl(cellValue)
                    
                    return (
                      <td 
                        key={col} 
                        style={{
                          padding: cellPadding || '0.5rem 1rem',
                          ...(textColor && !isImage && { color: textColor }),
                          ...(component.style?.fontSize && !isImage && { fontSize: component.style?.fontSize }),
                          backgroundColor: 'transparent',
                          ...(isImage && {
                            padding: '0.5rem',
                            textAlign: 'center' as const,
                          }),
                        }}
                      >
                        {isImage ? (
                          <img
                            src={cellValue}
                            alt={`${col} image`}
                            style={{
                              maxWidth: '100px',
                              maxHeight: '100px',
                              objectFit: 'contain',
                              borderRadius: '4px',
                              display: 'block',
                              margin: '0 auto',
                            }}
                            loading="lazy"
                            onError={(e) => {
                              // Fallback to text if image fails to load
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const fallback = document.createElement('span')
                              fallback.textContent = cellValue
                              fallback.style.color = textColor || 'inherit'
                              target.parentElement?.appendChild(fallback)
                            }}
                          />
                        ) : (
                          cellValue
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}
