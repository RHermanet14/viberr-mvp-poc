'use client'

import { useState, useRef, useEffect } from 'react'
import { DesignSchema } from '@/lib/schema'

interface AIPromptProps {
  onPrompt: (prompt: string, images?: File[]) => Promise<void>
  schema?: DesignSchema | null
  showExamples?: boolean
}

export function AIPrompt({ onPrompt, schema, showExamples = true }: AIPromptProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Convert file to base64 data URL
  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Resize image if too large (max 2048px)
  const resizeImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      img.onload = () => {
        const maxSize = 2048
        let width = img.width
        let height = img.height
        
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize
            width = maxSize
          } else {
            width = (width / height) * maxSize
            height = maxSize
          }
        }
        
        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob((blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, { type: file.type })
            resolve(resizedFile)
          } else {
            resolve(file)
          }
        }, file.type, 0.9)
      }
      
      img.onerror = () => resolve(file)
      img.src = URL.createObjectURL(file)
    })
  }

  // Validate image file
  const validateImageFile = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const maxSize = 5 * 1024 * 1024 // 5MB
    
    if (!validTypes.includes(file.type)) {
      alert('Invalid image type. Please upload JPEG, PNG, WebP, or GIF.')
      return false
    }
    
    if (file.size > maxSize) {
      alert('Image too large. Maximum size is 5MB.')
      return false
    }
    
    return true
  }

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    
    const validFiles: File[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (validateImageFile(file)) {
        const resized = await resizeImage(file)
        validFiles.push(resized)
      }
    }
    
    if (validFiles.length > 0) {
      setUploadedImages(prev => [...prev, ...validFiles])
    }
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    )
    
    if (files.length > 0) {
      handleFileSelect(files as unknown as FileList)
    }
  }

  // Handle paste from clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      
      const imageFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file && validateImageFile(file)) {
            const resized = await resizeImage(file)
            imageFiles.push(resized)
          }
        }
      }
      
      if (imageFiles.length > 0) {
        setUploadedImages(prev => [...prev, ...imageFiles])
      }
    }
    
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  // Remove uploaded image
  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!prompt.trim() && uploadedImages.length === 0) || loading) return

    setLoading(true)
    try {
      await onPrompt(prompt, uploadedImages.length > 0 ? uploadedImages : undefined)
      setPrompt('')
      setUploadedImages([])
    } finally {
      setLoading(false)
    }
  }

  const isDark = schema?.theme.mode === 'dark'
  const inputStyle = {
    backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
    color: isDark ? '#ffffff' : '#000000',
    borderColor: isDark ? '#4a4a4a' : '#d1d5db',
  }
  const textColor = isDark ? '#9ca3af' : '#6b7280'

  const primaryColor = schema?.theme.primaryColor || '#3b82f6'

  return (
    <div className="flex-1 min-w-0">
      <form onSubmit={handleSubmit}>
        <div 
          ref={dropZoneRef}
          className="relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div 
              className="absolute inset-0 z-10 bg-blue-500 bg-opacity-10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center"
              style={{ pointerEvents: 'none' }}
            >
              <p className="text-blue-500 font-medium">Drop image here</p>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Try: 'Make it dark mode, bigger text, show top 10 by revenue, add a bar chart by month'"
              className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none"
              style={{
                ...inputStyle,
                height: '32px',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 2px ${primaryColor}40`
                e.currentTarget.style.borderColor = primaryColor
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = ''
                e.currentTarget.style.borderColor = inputStyle.borderColor as string
              }}
              disabled={loading}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1.5"
              style={{
                ...inputStyle,
                height: '32px',
                borderColor: inputStyle.borderColor,
              }}
              title="Upload image for style reference"
            >
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload
            </button>
            <button
              type="submit"
              disabled={loading || (!prompt.trim() && uploadedImages.length === 0)}
              className="px-4 py-1.5 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              style={{
                backgroundColor: primaryColor,
                color: '#ffffff',
                height: '32px',
              }}
              onMouseEnter={(e) => {
                if (!loading && (prompt.trim() || uploadedImages.length > 0)) {
                  e.currentTarget.style.opacity = '0.9'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              {loading ? 'Processing...' : 'Apply'}
            </button>
          </div>
        </div>
        {uploadedImages.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {uploadedImages.map((image, index) => (
              <div
                key={index}
                className="relative inline-block"
                style={{ width: '60px', height: '60px' }}
              >
                <img
                  src={URL.createObjectURL(image)}
                  alt={`Uploaded ${index + 1}`}
                  className="w-full h-full object-cover rounded border"
                  style={{ borderColor: inputStyle.borderColor }}
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                  style={{ fontSize: '12px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </form>
      {showExamples !== false && (
        <p className="mt-1.5 text-xs" style={{ color: textColor }}>
          Examples: "Dark mode", "Bigger font", "Two columns", "Add pie chart", "Sort by price" | Upload image to replicate its style
        </p>
      )}
    </div>
  )
}
