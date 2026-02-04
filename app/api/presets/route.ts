import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateSchema } from '@/lib/validation'
import { Prisma } from '@prisma/client'
import { logError } from '@/lib/logger'

// GET - List all presets for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const presets = await prisma.userPreset.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ presets })
  } catch (error: any) {
    logError({
      endpoint: '/api/presets',
      error: error.message || 'Failed to load presets',
    })
    return NextResponse.json(
      { error: 'Failed to load presets' },
      { status: 500 }
    )
  }
}

// POST - Create a new preset
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, schema } = await request.json()

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Preset name is required' },
        { status: 400 }
      )
    }

    if (!schema) {
      return NextResponse.json(
        { error: 'Schema is required' },
        { status: 400 }
      )
    }

    // Validate the schema
    const schemaValidation = validateSchema(schema)
    if (!schemaValidation.valid) {
      return NextResponse.json(
        { error: schemaValidation.error || 'Invalid schema format' },
        { status: 400 }
      )
    }

    // Check for duplicate preset names for this user
    const existingPreset = await prisma.userPreset.findFirst({
      where: {
        userId: session.user.id,
        name: name.trim(),
      },
    })

    if (existingPreset) {
      return NextResponse.json(
        { error: 'A preset with this name already exists' },
        { status: 409 }
      )
    }

    // Create the preset
    const preset = await prisma.userPreset.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        schemaJSON: schema as unknown as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ preset }, { status: 201 })
  } catch (error: any) {
    logError({
      endpoint: '/api/presets',
      error: error.message || 'Failed to create preset',
    })
    return NextResponse.json(
      { error: 'Failed to create preset' },
      { status: 500 }
    )
  }
}
