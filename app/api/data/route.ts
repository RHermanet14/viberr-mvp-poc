import { NextResponse } from 'next/server'

// Mock data - in production this would come from an external API
const mockProducts = [
  { id: 1, title: 'Product A', category: 'Electronics', price: 299.99, date: '2024-01-15' },
  { id: 2, title: 'Product B', category: 'Clothing', price: 49.99, date: '2024-01-20' },
  { id: 3, title: 'Product C', category: 'Electronics', price: 599.99, date: '2024-02-01' },
  { id: 4, title: 'Product D', category: 'Food', price: 12.99, date: '2024-02-05' },
  { id: 5, title: 'Product E', category: 'Clothing', price: 79.99, date: '2024-02-10' },
  { id: 6, title: 'Product F', category: 'Electronics', price: 299.99, date: '2024-02-15' },
  { id: 7, title: 'Product G', category: 'Food', price: 8.99, date: '2024-02-20' },
  { id: 8, title: 'Product H', category: 'Clothing', price: 129.99, date: '2024-03-01' },
  { id: 9, title: 'Product I', category: 'Electronics', price: 899.99, date: '2024-03-05' },
  { id: 10, title: 'Product J', category: 'Food', price: 15.99, date: '2024-03-10' },
  { id: 11, title: 'Product K', category: 'Electronics', price: 199.99, date: '2024-03-15' },
  { id: 12, title: 'Product L', category: 'Clothing', price: 59.99, date: '2024-03-20' },
]

export async function GET() {
  return NextResponse.json(mockProducts)
}
