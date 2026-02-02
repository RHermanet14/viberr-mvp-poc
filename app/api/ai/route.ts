import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateDesignOperations } from '@/lib/ai'
import { applyOperations, DesignSchema } from '@/lib/schema'
import { Prisma } from '@prisma/client'
import { checkRateLimit } from '@/lib/rateLimit'
import { logAIRequest, logError } from '@/lib/logger'
import { validateSchema, validateOperations, validateComponentIds } from '@/lib/validation'

export async function POST(request: Request) {
  const startTime = Date.now()
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limiting: 10 requests per minute per user
  const rateLimit = checkRateLimit(session.user.id, 10, 60 * 1000)
  if (!rateLimit.allowed) {
    logError({
      endpoint: '/api/ai',
      error: 'Rate limit exceeded',
    })
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded. Please try again later.',
        resetAt: rateLimit.resetAt,
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        },
      }
    )
  }

  try {
    const { prompt, schema } = await request.json()

    if (!prompt || !schema) {
      return NextResponse.json(
        { error: 'Missing prompt or schema' },
        { status: 400 }
      )
    }

    // Validate input schema before processing
    const schemaValidation = validateSchema(schema)
    if (!schemaValidation.valid) {
      logError({
        endpoint: '/api/ai',
        error: schemaValidation.error || 'Schema validation failed',
      })
      return NextResponse.json(
        { error: schemaValidation.error || 'Invalid schema format' },
        { status: 400 }
      )
    }

    const typedSchema = schema as DesignSchema

    // Generate operations from AI
    const operations = await generateDesignOperations(prompt, typedSchema)
    
    // Validate operations structure
    const operationsValidation = validateOperations(operations)
    if (!operationsValidation.valid) {
      logError({
        endpoint: '/api/ai',
        prompt,
        operationsCount: operations.length,
        error: operationsValidation.error || 'Operations validation failed',
      })
      return NextResponse.json(
        { error: operationsValidation.error || 'Invalid operations format' },
        { status: 400 }
      )
    }

    // Validate component IDs referenced in operations exist
    // Per design spec: "Unknown component id → ignored with warning"
    // This filters out invalid operations instead of rejecting the entire request
    const componentIdValidation = validateComponentIds(operations, typedSchema)
    const validOperations = componentIdValidation.filteredOperations
    const warnings: string[] = [...componentIdValidation.warnings]
    
    // Log warnings if any operations were filtered out
    if (componentIdValidation.warnings.length > 0) {
      logError({
        endpoint: '/api/ai',
        prompt,
        operationsCount: operations.length,
        validOperationsCount: validOperations.length,
        warnings: componentIdValidation.warnings,
        error: `${componentIdValidation.warnings.length} operation(s) referenced unknown component IDs and were ignored`,
      })
    }

    // Apply operations
    const applyResult = applyOperations(typedSchema, validOperations)
    const updatedSchema = applyResult.schema
    warnings.push(...applyResult.warnings)
    
    // Validate resulting schema
    const resultValidation = validateSchema(updatedSchema)
    if (!resultValidation.valid) {
      logError({
        endpoint: '/api/ai',
        prompt,
        operationsCount: operations.length,
        error: resultValidation.error || 'Result schema validation failed',
      })
      return NextResponse.json(
        { error: resultValidation.error || 'Resulting schema is invalid' },
        { status: 500 }
      )
    }

    const durationMs = Date.now() - startTime

    // Structured logging (no PII - only operations and metadata)
    logAIRequest({
      prompt,
      operationsCount: operations.length,
      operations: operations.map(op => ({
        op: op.op,
        // Only log operation structure, not full component data to reduce log size
        ...(op.op === 'add_component' ? { componentId: op.component.id, componentType: op.component.type } : {}),
        ...(op.op === 'remove_component' || op.op === 'move_component' || op.op === 'replace_component' || op.op === 'reorder_component' ? { componentId: op.id } : {}),
        ...(op.op === 'set_style' || op.op === 'update' ? { path: op.path } : {}),
      })),
      componentCountBefore: typedSchema.components.length,
      componentCountAfter: updatedSchema.components.length,
      durationMs,
    })

    // Save updated schema
    await prisma.userSchema.upsert({
      where: { userId: session.user.id },
      update: { schemaJSON: updatedSchema as unknown as Prisma.InputJsonValue },
      create: {
        userId: session.user.id,
        schemaJSON: updatedSchema as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({
      operations: validOperations, // Return only valid operations that were applied
      schema: updatedSchema,
      warnings: warnings.length > 0 ? warnings : undefined, // Include warnings if any
    }, {
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetAt.toString(),
      },
    })
  } catch (error: any) {
    const durationMs = Date.now() - startTime
    logError({
      endpoint: '/api/ai',
      error: error.message || 'Failed to process AI request',
      durationMs,
    })
    return NextResponse.json(
      { error: error.message || 'Failed to process AI request' },
      { status: 500 }
    )
  }
}
