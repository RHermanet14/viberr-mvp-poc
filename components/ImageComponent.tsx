'use client'

import { useState, useEffect, useRef } from 'react'
import { Component } from '@/lib/schema'

interface ImageComponentProps {
  component: Component
}

export function ImageComponent({ component }: ImageComponentProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const src = component.props.src
  const alt = component.props.alt || 'Image'
  // Always default to 'contain' to show full image without cropping, regardless of what AI sets
  // Only use 'cover' if explicitly set in style (not props)
  const objectFit = component.style?.objectFit || 'contain'
  const objectPosition = component.props.objectPosition || component.style?.objectPosition || 'center'
  const lazy = component.props.lazy !== false // Default to true

  // Validate URL format and detect placeholder URLs
  const validateImageUrl = (url: string): boolean => {
    try {
      // Basic URL format validation
      new URL(url)
      
      // Check if it's a placeholder/example URL
      const placeholderPatterns = [
        'example.com',
        'placeholder',
        'via.placeholder.com',
        'placehold.it',
        'dummyimage.com',
        'unsplash.com/photo-1234567890', // Unsplash placeholder pattern
        'images.unsplash.com/photo-1234567890', // Unsplash placeholder pattern
        'unsplash.com/photo-', // Any unsplash photo placeholder
        'images.unsplash.com/photo-', // Any unsplash photo placeholder
      ]
      
      const lowerUrl = url.toLowerCase()
      if (placeholderPatterns.some(pattern => lowerUrl.includes(pattern))) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  // Reset loading state when src changes
  useEffect(() => {
    if (src) {
      setLoading(true)
      setError(null)
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // Quick format validation
      const isValid = validateImageUrl(src)
      if (!isValid) {
        setLoading(false)
        if (src.includes('example.com') || src.includes('placeholder')) {
          setError('Invalid image URL: Placeholder URL detected. Please provide a real image URL.')
        } else {
          setError('Invalid image URL format')
        }
        return
      }

      // Set 30-second timeout for loading (increased from 10s for slow networks/large images)
      // The timeout will be cleared by handleLoad if the image loads successfully
      timeoutRef.current = setTimeout(() => {
        // Only set error if we're still in loading state (image hasn't loaded yet)
        setLoading((currentLoading) => {
          if (currentLoading) {
            setError('Image failed to load within 30 seconds. The image may be slow to load or the server may be unavailable.')
            return false
          }
          return currentLoading
        })
        timeoutRef.current = null
      }, 30000) // 30 seconds
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [src])

  // Apply custom styles from component.style
  const imageStyle = {
    width: '100%',
    height: '100%',
    minWidth: component.style?.minWidth,
    minHeight: component.style?.minHeight,
    maxWidth: component.style?.maxWidth || '100%',
    maxHeight: component.style?.maxHeight || '100%',
    objectFit: objectFit, // Always use 'contain' by default (set above)
    objectPosition: objectPosition,
    borderRadius: component.style?.borderRadius,
    border: component.style?.border,
    borderColor: component.style?.borderColor,
    borderWidth: component.style?.borderWidth,
    borderStyle: component.style?.borderStyle,
    boxShadow: component.style?.boxShadow,
    opacity: component.style?.opacity,
    filter: component.style?.filter,
    transform: component.style?.transform,
    transition: component.style?.transition,
    cursor: component.style?.cursor,
    ...component.style,
  }

  const containerStyle = {
    padding: component.style?.padding,
    margin: component.style?.margin,
    backgroundColor: component.style?.backgroundColor,
    borderRadius: component.style?.borderRadius,
    boxShadow: component.style?.boxShadow,
    display: component.style?.display || 'block',
    width: component.style?.width || '100%',
    height: component.style?.height || '300px', // Default height if not specified
    minHeight: component.style?.minHeight || '200px', // Ensure minimum height
    overflow: 'hidden' as const,
    position: 'relative' as const, // For absolute positioning of loading/error states
    ...(component.style?.cardStyle && {
      boxShadow: component.style?.boxShadow || '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      borderRadius: component.style?.borderRadius || '0.75rem',
      padding: '1rem',
    }),
  }

  const handleLoad = () => {
    // Clear timeout if image loads successfully
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setLoading(false)
    setError(null)
  }

  const handleError = () => {
    // Clear timeout if image errors
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setLoading(false)
    setError('Failed to load image')
  }

  if (!src) {
    return (
      <div
        style={{
          ...containerStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100px',
          backgroundColor: '#f3f4f6',
          color: '#6b7280',
          border: '1px dashed #d1d5db',
        }}
      >
        <span>No image source provided</span>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f3f4f6',
            color: '#6b7280',
          }}
        >
          Loading...
        </div>
      )}
      {error ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            borderRadius: component.style?.borderRadius || '0.5rem',
            padding: '1rem',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontWeight: 'bold' }}>{error}</span>
          {src && (
            <code
              style={{
                fontSize: '0.75rem',
                backgroundColor: '#fecaca',
                padding: '0.5rem',
                borderRadius: '0.25rem',
                wordBreak: 'break-all',
                maxWidth: '100%',
                overflow: 'auto',
                cursor: 'text',
                userSelect: 'all',
              }}
              title="Click to select full URL"
            >
              {src}
            </code>
          )}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={lazy ? 'lazy' : 'eager'}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            ...imageStyle,
            display: 'block', // Always show image - let browser handle loading state
            width: '100%',
            height: '100%',
            opacity: loading ? 0.3 : 1, // Show with reduced opacity while loading instead of hiding
            transition: 'opacity 0.3s ease',
          }}
        />
      )}
    </div>
  )
}
