/**
 * Image color extraction utility
 * Extracts primary colors and style information from images
 * Works in both browser and Node.js environments
 */

export interface ImageColorAnalysis {
  primaryColors: string[]
  themeMode: 'dark' | 'light'
  backgroundColor: string
  textColor: string
  accentColor: string
  styleDescription: string
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * Calculate brightness of a color (0-255)
 */
function getBrightness(r: number, g: number, b: number): number {
  // Using relative luminance formula
  return (r * 299 + g * 587 + b * 114) / 1000
}

/**
 * Calculate saturation of a color (0-1)
 */
function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (max === 0) return 0
  return delta / max
}

/**
 * Quantize color to reduce palette (round to nearest step)
 */
function quantizeColor(r: number, g: number, b: number, step: number = 32): [number, number, number] {
  return [
    Math.round(r / step) * step,
    Math.round(g / step) * step,
    Math.round(b / step) * step,
  ]
}

/**
 * Process raw pixel data to extract colors
 */
function processPixelData(data: Uint8ClampedArray): ImageColorAnalysis {
  // Sample pixels (every 10th pixel for performance)
  const colorMap = new Map<string, number>()
  const brightnesses: number[] = []
  const saturations: Array<{ color: string; saturation: number }> = []
  
  for (let i = 0; i < data.length; i += 40) { // RGBA, so every 10th pixel = i += 40
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    
    // Skip transparent pixels
    if (a < 128) continue
    
    // Quantize color to reduce palette
    const [qr, qg, qb] = quantizeColor(r, g, b, 32)
    const colorKey = `${qr},${qg},${qb}`
    
    // Count color frequency
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1)
    
    // Track brightness and saturation
    const brightness = getBrightness(r, g, b)
    brightnesses.push(brightness)
    
    const saturation = getSaturation(r, g, b)
    saturations.push({
      color: rgbToHex(qr, qg, qb),
      saturation,
    })
  }
  
  // Sort colors by frequency (most common first)
  const sortedColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Top 10 colors
  
  // Get primary colors (top 5)
  const primaryColors = sortedColors.slice(0, 5).map(([colorKey]) => {
    const [r, g, b] = colorKey.split(',').map(Number)
    return rgbToHex(r, g, b)
  })
  
  // Determine theme mode based on average brightness
  const avgBrightness = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length
  const themeMode: 'dark' | 'light' = avgBrightness < 128 ? 'dark' : 'light'
  
  // Find background color (darkest/most common dark color)
  const darkColors = sortedColors
    .filter(([colorKey]) => {
      const [r, g, b] = colorKey.split(',').map(Number)
      return getBrightness(r, g, b) < 128
    })
    .slice(0, 3)
  
  const backgroundColor = darkColors.length > 0
    ? (() => {
        const [r, g, b] = darkColors[0][0].split(',').map(Number)
        return rgbToHex(r, g, b)
      })()
    : (themeMode === 'dark' ? '#1a1a1a' : '#ffffff')
  
  // Find text color (lightest/most common light color)
  const lightColors = sortedColors
    .filter(([colorKey]) => {
      const [r, g, b] = colorKey.split(',').map(Number)
      return getBrightness(r, g, b) > 128
    })
    .slice(0, 3)
  
  const textColor = lightColors.length > 0
    ? (() => {
        const [r, g, b] = lightColors[0][0].split(',').map(Number)
        return rgbToHex(r, g, b)
      })()
    : (themeMode === 'dark' ? '#ffffff' : '#000000')
  
  // Find accent color (most saturated color)
  const sortedBySaturation = saturations
    .sort((a, b) => b.saturation - a.saturation)
    .slice(0, 5)
  
  const accentColor = sortedBySaturation.length > 0 && sortedBySaturation[0].saturation > 0.3
    ? sortedBySaturation[0].color
    : (primaryColors[0] || '#3b82f6')
  
  // Generate style description
  const styleDescription = `Primary colors: ${primaryColors.slice(0, 3).join(', ')}. Theme mode: ${themeMode}. Background: ${backgroundColor}, Text: ${textColor}, Accent: ${accentColor}.`
  
  return {
    primaryColors,
    themeMode,
    backgroundColor,
    textColor,
    accentColor,
    styleDescription,
  }
}

/**
 * Extract dominant colors from image (server-side using sharp or canvas)
 */
export async function extractImageColors(imageBase64: string): Promise<ImageColorAnalysis> {
  // Check if we're in Node.js environment
  if (typeof window === 'undefined') {
    // Server-side: Use sharp if available
    try {
      const sharp = require('sharp')
      const buffer = Buffer.from(imageBase64.split(',')[1] || imageBase64, 'base64')
      
      // Resize for performance (max 500px)
      const image = sharp(buffer)
      const metadata = await image.metadata()
      const maxSize = 500
      let width = metadata.width || 500
      let height = metadata.height || 500
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height / width) * maxSize)
          width = maxSize
        } else {
          width = Math.round((width / height) * maxSize)
          height = maxSize
        }
      }
      
      // Get raw RGBA pixel data
      const { data, info } = await image
        .resize(width, height)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      
      // Convert Buffer to Uint8ClampedArray for processing
      const pixelData = new Uint8ClampedArray(data)
      return processPixelData(pixelData)
    } catch {
      // Fallback: return default colors if sharp fails
      return {
        primaryColors: ['#3b82f6', '#1a1a1a', '#ffffff'],
        themeMode: 'light',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        accentColor: '#3b82f6',
        styleDescription: 'Image uploaded for style reference. Apply modern, clean aesthetic with appropriate colors and typography.',
      }
    }
  } else {
    // Browser-side: Use Canvas API
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      img.onload = () => {
        try {
          // Create canvas and resize for performance (max 500px)
          const maxSize = 500
          let width = img.width
          let height = img.height
          
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height / width) * maxSize)
              width = maxSize
            } else {
              width = Math.round((width / height) * maxSize)
              height = maxSize
            }
          }
          
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'))
            return
          }
          
          // Draw image to canvas
          ctx.drawImage(img, 0, 0, width, height)
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, width, height)
          resolve(processPixelData(imageData.data))
        } catch (error: any) {
          reject(error)
        }
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      
      img.src = imageBase64
    })
  }
}
