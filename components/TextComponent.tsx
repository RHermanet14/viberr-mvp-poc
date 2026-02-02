'use client'

import { Component } from '@/lib/schema'

interface TextComponentProps {
  component: Component
}

export function TextComponent({ component }: TextComponentProps) {
  const content = component.props.content || 'Text component'
  const align = component.props.align || component.style?.textAlign || 'left'

  // Apply custom styles from component.style
  const textStyle = {
    padding: component.style?.padding || '1rem',
    textAlign: align,
    color: component.style?.color,
    fontSize: component.style?.fontSize,
    fontWeight: component.style?.fontWeight,
    backgroundColor: component.style?.backgroundColor,
    backgroundImage: component.style?.backgroundImage,
    backgroundSize: component.style?.backgroundSize || 'cover',
    backgroundPosition: component.style?.backgroundPosition || 'center',
    backgroundRepeat: component.style?.backgroundRepeat || 'no-repeat',
    border: component.style?.border,
    borderRadius: component.style?.borderRadius,
    boxShadow: component.style?.boxShadow,
    transition: component.style?.boxShadow ? 'box-shadow 0.3s ease' : undefined,
    ...component.style,
  }
  const cardStyle = component.style?.cardStyle === true

  return (
    <div
      style={{
        ...textStyle,
        ...(cardStyle && {
          boxShadow: textStyle.boxShadow || '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          borderRadius: textStyle.borderRadius || '0.75rem',
        }),
      }}
      onMouseEnter={(e) => {
        if (cardStyle && !textStyle.boxShadow) {
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (cardStyle && !textStyle.boxShadow) {
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }
      }}
    >
      {content}
    </div>
  )
}
