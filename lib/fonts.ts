// Popular Google Fonts list for AI reference
export const POPULAR_GOOGLE_FONTS = [
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Oswald',
  'Raleway',
  'Poppins',
  'Source Sans Pro',
  'Playfair Display',
  'Merriweather',
  'Ubuntu',
  'Nunito',
  'PT Sans',
  'Dancing Script',
  'Crimson Text',
  'Lora',
  'Bebas Neue',
  'Fira Sans',
  'Arimo',
  'Noto Sans',
  'Work Sans',
  'Inter',
  'Comfortaa',
  'Quicksand',
  'Josefin Sans',
] as const

// Convert font name to Google Fonts URL format
export function getGoogleFontUrl(fontName: string): string {
  // Normalize font name: remove spaces, handle special characters
  const normalized = fontName
    .trim()
    .replace(/\s+/g, '+')
    .replace(/['"]/g, '')
  
  return `https://fonts.googleapis.com/css2?family=${normalized}:wght@300;400;500;600;700&display=swap`
}

// Get CSS-safe font family string
export function getFontFamily(fontName: string): string {
  // If it's a system font, return as-is
  const systemFonts = ['system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy']
  if (systemFonts.includes(fontName.toLowerCase())) {
    return fontName
  }

  // Check if it's a known Google Font
  const isGoogleFont = POPULAR_GOOGLE_FONTS.some(
    font => font.toLowerCase() === fontName.toLowerCase()
  )

  if (isGoogleFont || fontName.includes(' ')) {
    // Quote font names with spaces
    return `"${fontName}", sans-serif`
  }

  // Return as-is with fallback
  return `${fontName}, sans-serif`
}

// Validate font name (check if it's a known Google Font or system font)
export function isValidFontName(fontName: string): boolean {
  if (!fontName || typeof fontName !== 'string') {
    return false
  }

  const normalized = fontName.toLowerCase().trim()
  
  // System fonts
  const systemFonts = ['system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'arial', 'helvetica', 'times', 'courier']
  if (systemFonts.includes(normalized)) {
    return true
  }

  // Known Google Fonts
  const isKnownFont = POPULAR_GOOGLE_FONTS.some(
    font => font.toLowerCase() === normalized
  )

  // Allow any font name (user might use custom fonts)
  // Just ensure it's a valid string
  return normalized.length > 0 && normalized.length < 100
}

// Load Google Font dynamically by injecting link tag
export function loadGoogleFont(fontName: string): void {
  if (typeof window === 'undefined') {
    return // Server-side, skip
  }

  // Check if font is already loaded
  const existingLink = document.querySelector(`link[data-font="${fontName}"]`)
  if (existingLink) {
    return // Already loaded
  }

  // Check if it's a system font
  const systemFonts = ['system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy']
  if (systemFonts.includes(fontName.toLowerCase())) {
    return // No need to load system fonts
  }

  // Create and inject link tag
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = getGoogleFontUrl(fontName)
  link.setAttribute('data-font', fontName)
  document.head.appendChild(link)
}

// Extract font names from schema (theme and components)
export function extractFontNames(schema: any): string[] {
  const fonts = new Set<string>()

  // Theme font
  if (schema.theme?.fontFamily) {
    // Extract font name from font-family string (remove quotes, fallbacks)
    const themeFont = schema.theme.fontFamily
      .split(',')[0]
      .trim()
      .replace(/['"]/g, '')
    if (themeFont) {
      fonts.add(themeFont)
    }
  }

  // Component fonts
  if (schema.components && Array.isArray(schema.components)) {
    schema.components.forEach((component: any) => {
      if (component.style?.fontFamily) {
        const componentFont = component.style.fontFamily
          .split(',')[0]
          .trim()
          .replace(/['"]/g, '')
        if (componentFont) {
          fonts.add(componentFont)
        }
      }
    })
  }

  return Array.from(fonts)
}
