import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return NextResponse.json({ valid: false, error: 'No URL provided' }, { status: 400 })
  }

  try {
    // Check for placeholder URLs
    const placeholderPatterns = [
      'example.com',
      'placeholder',
      'via.placeholder.com',
      'placehold.it',
      'dummyimage.com',
    ]
    
    const lowerUrl = imageUrl.toLowerCase()
    if (placeholderPatterns.some(pattern => lowerUrl.includes(pattern))) {
      return NextResponse.json({ valid: false, error: 'Placeholder URL detected' })
    }

    // Validate URL format
    new URL(imageUrl)

    // Make HEAD request to check if image exists
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      const response = await fetch(imageUrl, { 
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ImageValidator/1.0)',
        },
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.startsWith('image/')) {
          return NextResponse.json({ valid: true })
        } else {
          return NextResponse.json({ valid: false, error: 'URL does not point to an image' })
        }
      } else {
        return NextResponse.json({ valid: false, error: `HTTP ${response.status}` })
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({ valid: false, error: 'Request timeout' })
      }
      throw fetchError
    }
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('Invalid URL')) {
      return NextResponse.json({ valid: false, error: 'Invalid URL format' })
    }
    return NextResponse.json({ valid: false, error: 'Failed to validate URL' })
  }
}
