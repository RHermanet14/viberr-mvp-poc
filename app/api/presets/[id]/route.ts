import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { DesignSchema } from '@/lib/schema'

// GET - Get a specific preset by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preset = await prisma.userPreset.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!preset) {
      return NextResponse.json(
        { error: 'Preset not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      preset: {
        id: preset.id,
        name: preset.name,
        schema: preset.schemaJSON as unknown as DesignSchema,
        createdAt: preset.createdAt,
        updatedAt: preset.updatedAt,
      },
    })
  } catch (error: any) {
    logError({
      endpoint: `/api/presets/${params.id}`,
      error: error.message || 'Failed to load preset',
    })
    return NextResponse.json(
      { error: 'Failed to load preset' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a preset by ID
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if preset exists and belongs to user
    const preset = await prisma.userPreset.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!preset) {
      return NextResponse.json(
        { error: 'Preset not found' },
        { status: 404 }
      )
    }

    // Delete the preset
    await prisma.userPreset.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logError({
      endpoint: `/api/presets/${params.id}`,
      error: error.message || 'Failed to delete preset',
    })
    return NextResponse.json(
      { error: 'Failed to delete preset' },
      { status: 500 }
    )
  }
}
