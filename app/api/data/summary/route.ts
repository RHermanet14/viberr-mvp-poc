import { NextResponse } from 'next/server'
import { logError } from '@/lib/logger'

// Mock summary data - aggregated by month
const mockSummary = [
  { month: '2024-01', total: 349.98, count: 2, avgPrice: 174.99 },
  { month: '2024-02', total: 901.96, count: 5, avgPrice: 180.39 },
  { month: '2024-03', total: 1175.96, count: 5, avgPrice: 235.19 },
]

export async function GET() {
  try {
    // In production, this would aggregate from an external API or database
    // For now, return mock data
    return NextResponse.json(mockSummary)
  } catch (error: any) {
    logError({
      endpoint: '/api/data/summary',
      error: error.message || 'Failed to fetch summary data',
    })
    return NextResponse.json(
      { error: 'Failed to fetch summary data' },
      { status: 500 }
    )
  }
}
