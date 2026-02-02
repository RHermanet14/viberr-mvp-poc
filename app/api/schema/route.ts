import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultSchema, DesignSchema } from '@/lib/schema'
import { validateSchema } from '@/lib/validation'
import { Prisma } from '@prisma/client'
import { logError } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userSchema = await prisma.userSchema.findUnique({
      where: { userId: session.user.id },
    })

    if (!userSchema) {
      const defaultSchema = getDefaultSchema()
      // Create default schema
      await prisma.userSchema.create({
        data: {
          userId: session.user.id,
          schemaJSON: defaultSchema as unknown as Prisma.InputJsonValue,
        },
      })
      return NextResponse.json(defaultSchema)
    }

    return NextResponse.json(userSchema.schemaJSON as unknown as DesignSchema)
  } catch (error: any) {
    logError({
      endpoint: '/api/schema',
      error: error.message || 'Failed to load schema',
    })
    return NextResponse.json(
      { error: 'Failed to load schema' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schema = await request.json()

    // Validate schema before saving
    const validation = validateSchema(schema)
    if (!validation.valid) {
      logError({
        endpoint: '/api/schema',
        error: validation.error || 'Invalid schema format',
      })
      return NextResponse.json(
        { error: validation.error || 'Invalid schema format' },
        { status: 400 }
      )
    }

    // Optional: Save version history
    try {
      await prisma.userSchemaVersion.create({
        data: {
          userId: session.user.id,
          schemaJSON: schema as unknown as Prisma.InputJsonValue,
        },
      })
    } catch (versionError) {
      // Version history creation is optional - log but don't fail
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to save schema version history:', versionError)
      }
    }

    // Update or create schema
    await prisma.userSchema.upsert({
      where: { userId: session.user.id },
      update: { schemaJSON: schema as Prisma.InputJsonValue },
      create: {
        userId: session.user.id,
        schemaJSON: schema as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logError({
      endpoint: '/api/schema',
      error: error.message || 'Failed to save schema',
    })
    return NextResponse.json(
      { error: 'Failed to save schema' },
      { status: 500 }
    )
  }
}
