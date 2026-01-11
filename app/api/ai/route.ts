import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateDesignOperations } from '@/lib/ai'
import { applyOperations, DesignSchema } from '@/lib/schema'
import { Prisma } from '@prisma/client'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { prompt, schema } = await request.json()

    if (!prompt || !schema) {
      return NextResponse.json(
        { error: 'Missing prompt or schema' },
        { status: 400 }
      )
    }

    // Generate operations from AI
    const operations = await generateDesignOperations(prompt, schema as DesignSchema)

    // Apply operations
    const updatedSchema = applyOperations(schema as DesignSchema, operations)

    // Save updated schema
    await prisma.userSchema.upsert({
      where: { userId: session.user.id },
      update: { schemaJSON: updatedSchema as Prisma.InputJsonValue },
      create: {
        userId: session.user.id,
        schemaJSON: updatedSchema as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({
      operations,
      schema: updatedSchema,
    })
  } catch (error: any) {
    console.error('AI endpoint error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process AI request' },
      { status: 500 }
    )
  }
}
