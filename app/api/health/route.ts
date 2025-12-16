/**
 * Health Check Endpoint
 *
 * Provides system health status for monitoring and alerting.
 * Checks connectivity to critical services:
 * - Database (Supabase)
 * - Redis (rate limiting)
 * - OpenAI API
 *
 * Returns 200 if all systems healthy, 503 if any are down.
 *
 * @example
 * GET /api/health
 * {
 *   "status": "healthy",
 *   "timestamp": "2025-12-16T10:30:00.000Z",
 *   "uptime": 86400,
 *   "checks": {
 *     "database": { "status": "up", "latency": 45 },
 *     "redis": { "status": "up", "latency": 12 },
 *     "openai": { "status": "configured" }
 *   }
 * }
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Track application start time
const APP_START_TIME = Date.now()

export const dynamic = 'force-dynamic'

/**
 * Test database connectivity and measure latency
 */
async function testDatabaseConnection(): Promise<{ status: string; latency?: number; error?: string }> {
  try {
    const startTime = Date.now()
    const supabase = await createClient()

    // Simple query to test connection
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    const latency = Date.now() - startTime

    if (error) {
      return { status: 'down', error: error.message }
    }

    return { status: 'up', latency }
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Test Redis connectivity (if available)
 */
async function testRedisConnection(): Promise<{ status: string; latency?: number; error?: string }> {
  try {
    // Check if Redis environment variables are configured
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return { status: 'not_configured' }
    }

    const startTime = Date.now()

    // Simple ping to Redis
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/ping`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      }
    )

    const latency = Date.now() - startTime

    if (!response.ok) {
      return { status: 'down', error: `HTTP ${response.status}` }
    }

    return { status: 'up', latency }
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check if OpenAI API key is configured
 */
function checkOpenAIConfiguration(): { status: string } {
  if (!process.env.OPENAI_API_KEY) {
    return { status: 'not_configured' }
  }

  // Could optionally make a test API call here
  // For now, just check if key is present
  return { status: 'configured' }
}

/**
 * GET /api/health
 * Returns health status of all systems
 */
export async function GET() {
  try {
    // Run all health checks in parallel
    const [database, redis, openai] = await Promise.all([
      testDatabaseConnection(),
      testRedisConnection(),
      Promise.resolve(checkOpenAIConfiguration())
    ])

    // Determine overall health
    const isHealthy = database.status === 'up' &&
                      (redis.status === 'up' || redis.status === 'not_configured') &&
                      openai.status === 'configured'

    const uptime = Math.floor((Date.now() - APP_START_TIME) / 1000)

    const response = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime, // seconds since application start
      checks: {
        database,
        redis,
        openai
      }
    }

    return NextResponse.json(response, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    })
  } catch (error) {
    console.error('[Health] Health check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    )
  }
}

/**
 * HEAD /api/health
 * Quick health check (no response body)
 */
export async function HEAD() {
  try {
    // Quick database check only
    const supabase = await createClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)

    return new Response(null, {
      status: error ? 503 : 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    })
  } catch {
    return new Response(null, { status: 503 })
  }
}
