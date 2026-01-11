import { NextResponse } from 'next/server'

// Mock summary data - aggregated by month
const mockSummary = [
  { month: '2024-01', total: 349.98, count: 2, avgPrice: 174.99 },
  { month: '2024-02', total: 901.96, count: 5, avgPrice: 180.39 },
  { month: '2024-03', total: 1175.96, count: 5, avgPrice: 235.19 },
]

export async function GET() {
  return NextResponse.json(mockSummary)
}
