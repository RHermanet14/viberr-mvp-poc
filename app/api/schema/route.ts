import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultSchema, DesignSchema } from '@/lib/schema'
import { Prisma } from '@prisma/client'

export async function GET() {
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
        schemaJSON: defaultSchema as Prisma.JsonValue,
      },
    })
    return NextResponse.json(defaultSchema)
  }

  return NextResponse.json(userSchema.schemaJSON as DesignSchema)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schema = await request.json()

  // Optional: Save version history
  await prisma.userSchemaVersion.create({
    data: {
      userId: session.user.id,
      schemaJSON: schema as Prisma.JsonValue,
    },
  })

  // Update or create schema
  await prisma.userSchema.upsert({
    where: { userId: session.user.id },
    update: { schemaJSON: schema as Prisma.JsonValue },
    create: {
      userId: session.user.id,
      schemaJSON: schema as Prisma.JsonValue,
    },
  })

  return NextResponse.json({ success: true })
}
