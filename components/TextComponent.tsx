'use client'

import { Component } from '@/lib/schema'

interface TextComponentProps {
  component: Component
}

export function TextComponent({ component }: TextComponentProps) {
  const content = component.props.content || 'Text component'
  const align = component.props.align || 'left'

  return (
    <div 
      className="p-4"
      style={{ textAlign: align }}
    >
      {content}
    </div>
  )
}
